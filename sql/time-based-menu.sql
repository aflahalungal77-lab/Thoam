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
        and p.restaurant_id = restaurant_id
        and p.is_available = true
        and r.status = 'approved'
    )
  );

comment on table public.product_menu_schedules is
  'Optional time windows for products. No enabled schedule rows means the product is available all day when is_available is true. Timezone: Asia/Kolkata.';
