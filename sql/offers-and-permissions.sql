-- Tho'am offers and permissions migration.
-- Apply AFTER sql/schema.sql and BEFORE sql/fix-checkout-and-images.sql.
-- This migration is idempotent and preserves existing offer rows if the table already exists.

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 300),
  image_url text,
  scope text not null default 'order'
    check (scope in ('order', 'products')),
  discount_type text not null default 'percentage'
    check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null
    check (discount_value > 0 and (discount_type <> 'percentage' or discount_value <= 100)),
  product_ids uuid[] not null default '{}',
  min_order_amount numeric(10,2) not null default 0
    check (min_order_amount >= 0),
  max_discount numeric(10,2)
    check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_valid_schedule
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint offers_products_required
    check (scope <> 'products' or cardinality(product_ids) > 0)
);

create index if not exists offers_restaurant_active_schedule_idx
  on public.offers (restaurant_id, is_active, starts_at, ends_at);

alter table public.offers enable row level security;

grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;

drop policy if exists "Public can view currently active offers" on public.offers;
create policy "Public can view currently active offers"
  on public.offers for select to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Restaurant owners and admins view offers" on public.offers;
create policy "Restaurant owners and admins view offers"
  on public.offers for select to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  );

drop policy if exists "Restaurant owners and admins create offers" on public.offers;
create policy "Restaurant owners and admins create offers"
  on public.offers for insert to authenticated
  with check (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  );

drop policy if exists "Restaurant owners and admins update offers" on public.offers;
create policy "Restaurant owners and admins update offers"
  on public.offers for update to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  )
  with check (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  );

drop policy if exists "Restaurant owners and admins delete offers" on public.offers;
create policy "Restaurant owners and admins delete offers"
  on public.offers for delete to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    or public.current_role() = 'admin'
  );

-- The offers editor calls this helper before uploading or saving.
create or replace function public.can_manage_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and target_restaurant_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'admin'
          or (p.role = 'restaurant_owner' and p.restaurant_id = target_restaurant_id)
        )
    );
$$;

revoke all on function public.can_manage_restaurant(uuid) from public, anon;
grant execute on function public.can_manage_restaurant(uuid) to authenticated;

-- Offer images are public because customer-facing menus render public image URLs.
-- Uploads and mutations are limited to the owner's restaurant folder (or admins).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'offer-images',
  'offer-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Restaurant owners upload offer images" on storage.objects;
create policy "Restaurant owners upload offer images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'offer-images'
    and (
      (storage.foldername(name))[1] = public.current_restaurant_id()::text
      or public.current_role() = 'admin'
    )
  );

drop policy if exists "Restaurant owners update offer images" on storage.objects;
create policy "Restaurant owners update offer images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'offer-images'
    and (
      (storage.foldername(name))[1] = public.current_restaurant_id()::text
      or public.current_role() = 'admin'
    )
  )
  with check (
    bucket_id = 'offer-images'
    and (
      (storage.foldername(name))[1] = public.current_restaurant_id()::text
      or public.current_role() = 'admin'
    )
  );

drop policy if exists "Restaurant owners delete offer images" on storage.objects;
create policy "Restaurant owners delete offer images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'offer-images'
    and (
      (storage.foldername(name))[1] = public.current_restaurant_id()::text
      or public.current_role() = 'admin'
    )
  );

comment on table public.offers is
  'Restaurant promotions. Public reads are limited to active offers within their schedule; owners manage only their own restaurant offers.';
