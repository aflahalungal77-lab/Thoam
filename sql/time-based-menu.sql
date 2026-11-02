-- Time-based menu availability for Tho'am.
-- Apply once in Supabase SQL Editor. Times are interpreted in Asia/Kolkata.
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

drop policy if exists "menu schedules owner manage" on public.product_menu_schedules;
create policy "menu schedules owner manage"
  on public.product_menu_schedules
  for all
  to authenticated
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
  on public.product_menu_schedules
  for select
  to anon, authenticated
  using (
    is_enabled = true
    and exists (
      select 1
      from public.products p
      join public.restaurants r on r.id = p.restaurant_id
      where p.id = product_id
        and p.restaurant_id = product_menu_schedules.restaurant_id
        and p.is_available = true
        and r.status = 'approved'
    )
  );

comment on table public.product_menu_schedules is
  'Optional time windows for products. No enabled schedule rows means the product is available all day when is_available is true. Timezone: Asia/Kolkata.';


-- Enforce scheduled availability inside PostgreSQL as well as in the UI.
-- This protects service-role order endpoints from accepting out-of-window items.
create or replace function public.enforce_product_menu_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_local_now timestamp;
  v_weekday smallint;
  v_local_time time;
  v_has_schedule boolean;
  v_is_in_window boolean;
begin
  if new.product_id is null then
    return new;
  end if;

  select o.restaurant_id into v_restaurant_id
  from public.orders o
  where o.id = new.order_id;

  if v_restaurant_id is null then
    raise exception 'Invalid order restaurant.';
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = new.product_id
      and p.restaurant_id = v_restaurant_id
      and p.is_available = true
  ) then
    raise exception 'A selected menu item is unavailable.';
  end if;

  v_local_now := timezone('Asia/Kolkata', now());
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
    raise exception 'This item is not available at this time.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_menu_schedule_before_insert
  on public.order_items;
create trigger enforce_product_menu_schedule_before_insert
  before insert on public.order_items
  for each row execute function public.enforce_product_menu_schedule();
