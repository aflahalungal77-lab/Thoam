-- Tho'am production time-based menu schedules.
-- Apply this SQL in Supabase before deploying the application branch.
-- The rule applies only to signed-in delivery orders from /restaurants/[slug].
-- WhatsApp orders from /menu/[slug] and QR dine-in orders are intentionally excluded.

create table if not exists public.product_menu_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  starts_at time not null,
  ends_at time not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_menu_schedules_valid_days check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint product_menu_schedules_valid_time check (starts_at < ends_at)
);

create index if not exists product_menu_schedules_lookup_idx
  on public.product_menu_schedules (restaurant_id, product_id, is_enabled);

alter table public.product_menu_schedules enable row level security;

-- Explicit table grants; row-level security remains the tenant boundary.
grant select on public.product_menu_schedules to anon, authenticated;
grant insert, update, delete on public.product_menu_schedules to authenticated;

drop policy if exists "menu schedules owner manage" on public.product_menu_schedules;
create policy "menu schedules owner manage"
  on public.product_menu_schedules for all to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  )
  with check (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  );

drop policy if exists "menu schedules public read" on public.product_menu_schedules;
create policy "menu schedules public read"
  on public.product_menu_schedules for select to anon, authenticated
  using (
    is_enabled = true
    and exists (
      select 1
      from public.products p
      join public.restaurants r on r.id = p.restaurant_id
      where p.id = product_menu_schedules.product_id
        and p.restaurant_id = product_menu_schedules.restaurant_id
        and p.is_available = true
        and r.status = 'approved'
    )
  );

comment on table public.product_menu_schedules is
  'Optional Asia/Kolkata serving windows. Products without enabled windows remain available all day when is_available is true.';

-- Prevent overlapping enabled windows for the same product and weekday.
-- The transaction-scoped advisory lock closes the concurrent-write race.
create or replace function public.prevent_overlapping_product_menu_schedules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id
      and p.restaurant_id = new.restaurant_id
  ) then
    raise exception 'The selected product does not belong to this restaurant.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.restaurant_id::text || ':' || new.product_id::text, 0)
  );

  if new.is_enabled and exists (
    select 1
    from public.product_menu_schedules s
    where s.restaurant_id = new.restaurant_id
      and s.product_id = new.product_id
      and s.is_enabled = true
      and s.id <> new.id
      and s.weekdays && new.weekdays
      and s.starts_at < new.ends_at
      and new.starts_at < s.ends_at
  ) then
    raise exception 'This product already has an overlapping enabled schedule on one or more selected days.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists product_menu_schedules_no_overlap
  on public.product_menu_schedules;
create trigger product_menu_schedules_no_overlap
  before insert or update on public.product_menu_schedules
  for each row execute function public.prevent_overlapping_product_menu_schedules();

-- This trigger is scoped to signed-in delivery orders. /menu/[slug] creates
-- guest orders (customer_id IS NULL); QR ordering uses order_type='dine_in'.
-- Both existing flows bypass this schedule check by design.
create or replace function public.enforce_product_menu_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_customer_id uuid;
  v_order_type text;
  v_local_now timestamp;
  v_weekday smallint;
  v_local_time time;
  v_has_schedule boolean;
  v_is_in_window boolean;
begin
  if new.product_id is null then
    return new;
  end if;

  select o.restaurant_id, o.customer_id, o.order_type::text
    into v_restaurant_id, v_customer_id, v_order_type
  from public.orders o
  where o.id = new.order_id;

  if v_restaurant_id is null then
    raise exception 'Invalid order restaurant.';
  end if;

  if v_customer_id is null or v_order_type <> 'delivery' then
    return new;
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = new.product_id
      and p.restaurant_id = v_restaurant_id
      and p.is_available = true
  ) then
    raise exception 'A selected menu item is unavailable.';
  end if;

  v_local_now := timezone('Asia/Kolkata', clock_timestamp());
  v_weekday := extract(dow from v_local_now)::smallint;
  v_local_time := v_local_now::time;

  select exists (
    select 1 from public.product_menu_schedules s
    where s.product_id = new.product_id
      and s.restaurant_id = v_restaurant_id
      and s.is_enabled = true
  ) into v_has_schedule;

  if not v_has_schedule then
    return new;
  end if;

  select exists (
    select 1 from public.product_menu_schedules s
    where s.product_id = new.product_id
      and s.restaurant_id = v_restaurant_id
      and s.is_enabled = true
      and v_weekday = any(s.weekdays)
      and v_local_time >= s.starts_at
      and v_local_time < s.ends_at
  ) into v_is_in_window;

  if not v_is_in_window then
    raise exception 'A selected item is outside its scheduled serving time.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_menu_schedule_before_insert
  on public.order_items;
create trigger enforce_product_menu_schedule_before_insert
  before insert on public.order_items
  for each row execute function public.enforce_product_menu_schedule();

comment on function public.enforce_product_menu_schedule() is
  'Enforces IST schedules for signed-in delivery orders only; leaves guest WhatsApp and QR dine-in orders unchanged.';
