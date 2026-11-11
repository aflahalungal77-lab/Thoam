-- Tho'am production hardening migration
-- Applied to Supabase project uiykzclzlaqlljehikru on 2026-11-11.
-- Preserve all existing orders and restaurant settings. QR remains disabled per restaurant flag.
-- This migration intentionally does not create test orders or enable QR ordering.

-- QR order item instructions and kitchen lookup index.
alter table public.order_items
  add column if not exists special_instructions text;

create index if not exists orders_dine_in_kitchen_idx
  on public.orders (restaurant_id, order_type, status, created_at desc);

create or replace function public.create_qr_dine_in_order_v2(
  p_restaurant_id uuid, p_table_code text, p_notes text, p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_instruction text;
begin
  if p_restaurant_id is null then raise exception 'Invalid restaurant.'; end if;
  if length(trim(coalesce(p_table_code,''))) < 1 or length(p_table_code) > 50 then
    raise exception 'Invalid table QR code.';
  end if;
  if length(trim(coalesce(p_notes,''))) > 500 then
    raise exception 'Special instructions must be under 500 characters.';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Cart is empty or contains too many different items.';
  end if;

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id and status = 'approved' and qr_enabled = true
  for share;
  if not found then raise exception 'QR ordering is unavailable for this restaurant.'; end if;
  if not v_restaurant.is_open then raise exception 'This restaurant is currently closed.'; end if;

  select * into v_table
  from public.restaurant_tables
  where restaurant_id = p_restaurant_id
    and table_code = trim(p_table_code)
    and is_active = true
  for share;
  if not found then raise exception 'This table QR code is inactive or invalid.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'productId','') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Invalid product.';
    end if;
    if coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid quantity.';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Quantity must be between 1 and 50.'; end if;

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
      and restaurant_id = p_restaurant_id
    for share;
    if not found or not v_product.is_available then
      raise exception 'A menu item is no longer available. Refresh the menu.';
    end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
      raise exception 'Not enough stock for %.', v_product.name;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  insert into public.orders (
    restaurant_id, table_id, order_type, status, payment_method, payment_status,
    customer_name, customer_phone, delivery_address, notes,
    subtotal, delivery_fee, platform_fee, total_amount
  ) values (
    p_restaurant_id, v_table.id, 'dine_in', 'placed', 'cod', 'pending',
    null, '', null, nullif(trim(coalesce(p_notes,'')),''),
    v_subtotal, 0, 0, v_subtotal
  ) returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    v_instruction := left(trim(coalesce(v_item->>'specialInstructions','')),300);
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
      and restaurant_id = p_restaurant_id;

    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price,
      line_total, special_instructions
    ) values (
      v_order_id, v_product.id, v_product.name, v_qty, v_product.price,
      v_product.price * v_qty, nullif(v_instruction,'')
    );
  end loop;

  insert into public.order_status_history(order_id, old_status, new_status, note)
  values (v_order_id, null, 'placed', 'QR table order created; KOT');

  return jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number,
    'kot_number', v_order_number, 'total_amount', v_subtotal,
    'status', 'placed', 'created_at', now()
  );
end;
$$;

-- Shared, atomic rate limits for the QR API. No raw IP addresses are stored.
create table if not exists public.qr_order_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.qr_order_rate_limits enable row level security;
revoke all on public.qr_order_rate_limits from public, anon, authenticated;
drop policy if exists "Deny direct access to QR rate limits" on public.qr_order_rate_limits;
create policy "Deny direct access to QR rate limits"
on public.qr_order_rate_limits for all to anon, authenticated
using (false) with check (false);

create or replace function public.consume_qr_order_rate_limit(
  p_bucket_key text, p_limit integer, p_window_seconds integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer;
  v_window_started_at timestamptz;
begin
  if p_bucket_key is null or length(p_bucket_key) <> 64
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate-limit parameters.';
  end if;

  insert into public.qr_order_rate_limits as current_bucket (
    bucket_key, window_started_at, request_count, updated_at
  ) values (p_bucket_key, now(), 1, now())
  on conflict (bucket_key) do update set
    window_started_at = case
      when current_bucket.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now() else current_bucket.window_started_at end,
    request_count = case
      when current_bucket.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1 else current_bucket.request_count + 1 end,
    updated_at = now()
  returning request_count, window_started_at
  into v_count, v_window_started_at;

  if v_count % 100 = 0 then
    delete from public.qr_order_rate_limits
    where updated_at < now() - interval '1 day';
  end if;

  return query select
    v_count <= p_limit,
    greatest(1, ceil(extract(epoch from (
      v_window_started_at + make_interval(secs => p_window_seconds) - now()
    )))::integer);
end;
$$;

-- Order creation RPCs are only callable by the trusted server using service_role.
revoke all on function public.create_qr_dine_in_order_v2(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_qr_dine_in_order_v2(uuid,text,text,jsonb)
  to service_role;
revoke all on function public.consume_qr_order_rate_limit(text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_qr_order_rate_limit(text,integer,integer)
  to service_role;
revoke all on function public.create_qr_dine_in_order(uuid,text,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_qr_dine_in_order(uuid,text,text,text,text,jsonb)
  to service_role;
revoke all on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb,uuid)
  to service_role;

-- Keep the offers helper available only to authenticated managers and the server.
create or replace function public.can_manage_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select (select auth.uid()) is not null
    and target_restaurant_id is not null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and (
          p.role = 'admin'
          or (p.role = 'restaurant_owner' and p.restaurant_id = target_restaurant_id)
        )
    );
$$;
revoke all on function public.can_manage_restaurant(uuid) from public, anon;
grant execute on function public.can_manage_restaurant(uuid) to authenticated, service_role;

alter table public.offers enable row level security;
drop policy if exists "Customers can view active offers" on public.offers;
drop policy if exists "Public can view active offers" on public.offers;
drop policy if exists "Owners can create offers" on public.offers;
drop policy if exists "Owners can delete offers" on public.offers;
drop policy if exists "Owners can update offers" on public.offers;
drop policy if exists "Owners can view their offers" on public.offers;
drop policy if exists "Restaurant owners can insert offers" on public.offers;
drop policy if exists "Restaurant owners can update offers" on public.offers;
drop policy if exists "Restaurant owners can view their offers" on public.offers;
drop policy if exists "Public can view currently active offers" on public.offers;
drop policy if exists "Restaurant owners and admins view offers" on public.offers;
drop policy if exists "Restaurant owners and admins create offers" on public.offers;
drop policy if exists "Restaurant owners and admins update offers" on public.offers;
drop policy if exists "Restaurant owners and admins delete offers" on public.offers;
drop policy if exists "Offers owners delete managed restaurant" on public.offers;
drop policy if exists "Offers owners insert managed restaurant" on public.offers;
drop policy if exists "Offers owners read managed restaurant" on public.offers;
drop policy if exists "Offers owners update managed restaurant" on public.offers;
drop policy if exists "Offers public read within schedule" on public.offers;
drop policy if exists "Public read currently active offers" on public.offers;
drop policy if exists "Restaurant managers create offers" on public.offers;
drop policy if exists "Restaurant managers delete offers" on public.offers;
drop policy if exists "Restaurant managers read own offers" on public.offers;
drop policy if exists "Restaurant managers update offers" on public.offers;

create policy "Public read currently active offers"
on public.offers for select to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);
create policy "Restaurant managers read own offers"
on public.offers for select to authenticated
using ((select public.can_manage_restaurant(restaurant_id)));
create policy "Restaurant managers create offers"
on public.offers for insert to authenticated
with check ((select public.can_manage_restaurant(restaurant_id)));
create policy "Restaurant managers update offers"
on public.offers for update to authenticated
using ((select public.can_manage_restaurant(restaurant_id)))
with check ((select public.can_manage_restaurant(restaurant_id)));
create policy "Restaurant managers delete offers"
on public.offers for delete to authenticated
using ((select public.can_manage_restaurant(restaurant_id)));

revoke all on table public.offers from anon;
grant select on table public.offers to anon;
revoke all on table public.offers from authenticated;
grant select, insert, update, delete on table public.offers to authenticated;
grant all on table public.offers to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-images', 'offer-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Restaurant owners upload offer images" on storage.objects;
drop policy if exists "Restaurant managers upload offer images" on storage.objects;
drop policy if exists "Restaurant managers update offer images" on storage.objects;
drop policy if exists "Restaurant managers delete offer images" on storage.objects;

create policy "Restaurant managers upload offer images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'offer-images'
  and (storage.foldername(name))[1] is not null
  and (select public.can_manage_restaurant(((storage.foldername(name))[1])::uuid))
);
create policy "Restaurant managers update offer images"
on storage.objects for update to authenticated
using (
  bucket_id = 'offer-images'
  and (storage.foldername(name))[1] is not null
  and (select public.can_manage_restaurant(((storage.foldername(name))[1])::uuid))
)
with check (
  bucket_id = 'offer-images'
  and (storage.foldername(name))[1] is not null
  and (select public.can_manage_restaurant(((storage.foldername(name))[1])::uuid))
);
create policy "Restaurant managers delete offer images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'offer-images'
  and (storage.foldername(name))[1] is not null
  and (select public.can_manage_restaurant(((storage.foldername(name))[1])::uuid))
);

alter function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb,uuid)
  set search_path = pg_catalog, public, pg_temp;

-- Trigger-only functions are not callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_product_menu_schedule() from public, anon, authenticated;
