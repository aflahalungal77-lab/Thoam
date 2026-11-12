-- Tho'am product size / price options.
-- Apply this migration in Supabase SQL Editor after the existing COD and QR order migrations.
-- Existing products remain single-price products because variants defaults to an empty array.
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists variant_name text;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0);
create or replace function public.valid_product_variants(p_variants jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $valid_product_variants$
declare
  v jsonb;
  v_name text;
  v_price numeric;
  seen_names text[] := array[]::text[];
begin
  if jsonb_typeof(p_variants) is distinct from 'array' then return false; end if;
  for v in select value from jsonb_array_elements(p_variants)
  loop
    if jsonb_typeof(v) is distinct from 'object' then return false; end if;
    v_name := lower(trim(coalesce(v->>'name','')));
    if v_name = '' or length(v_name) > 40 or v_name = any(seen_names) then return false; end if;
    begin
      v_price := (v->>'price')::numeric;
    exception when others then
      return false;
    end;
    if v_price <= 0 then return false; end if;
    if v ? 'is_available' and jsonb_typeof(v->'is_available') <> 'boolean' then return false; end if;
    seen_names := array_append(seen_names, v_name);
  end loop;
  return true;
end;
$valid_product_variants$;

alter table public.products drop constraint if exists products_variants_array_check;
alter table public.products drop constraint if exists products_variants_valid_check;
alter table public.products add constraint products_variants_valid_check
  check (public.valid_product_variants(variants));

-- Apply AFTER sql/schema.sql in Supabase SQL Editor.
-- Atomic, server-only COD delivery order creation. The app API validates the signed-in user;
-- this function recalculates all prices and totals inside PostgreSQL in one transaction.
create or replace function public.create_cod_delivery_order(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_notes text,
  p_items jsonb,
  p_offer_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2);
  v_platform_fee numeric(10,2) := 1;
  v_discount_amount numeric(10,2) := 0;
  v_eligible_subtotal numeric(10,2) := 0;
  v_raw_discount numeric(10,2) := 0;
  v_total numeric(10,2);
  v_offer public.offers%rowtype;
  v_offer_title text := null;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant jsonb;
  v_variant_name text;
  v_unit_price numeric(10,2);
  v_qty integer;
  v_count integer := 0;
begin
  if p_customer_id is null or p_restaurant_id is null then
    raise exception 'Missing customer or restaurant.';
  end if;
  if coalesce(length(trim(p_customer_name)),0) < 1
     or length(regexp_replace(coalesce(p_customer_phone,''), '\D', '', 'g')) < 10
     or length(trim(coalesce(p_delivery_address,''))) < 8 then
    raise exception 'Enter your name, valid phone number and full delivery address.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Cart is empty or contains too many different items.';
  end if;

  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and status = 'approved' for share;
  if not found then raise exception 'Restaurant is not approved or available.'; end if;
  if not v_restaurant.is_open then raise exception 'This restaurant is currently closed.'; end if;
  if not v_restaurant.delivery_enabled then raise exception 'This restaurant has disabled delivery.'; end if;

  if p_offer_id is not null then
    select * into v_offer from public.offers
    where id = p_offer_id and restaurant_id = p_restaurant_id
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    for share;
    if not found or not v_offer.is_active then raise exception 'Selected offer is no longer available.'; end if;
    if (v_offer.starts_at is not null and now() < v_offer.starts_at)
       or (v_offer.ends_at is not null and now() > v_offer.ends_at) then
      raise exception 'Selected offer is not currently valid.';
    end if;
    if coalesce(v_offer.discount_value,0) <= 0
       or (v_offer.discount_type = 'percentage' and v_offer.discount_value > 100) then
      raise exception 'Selected offer has an invalid discount configuration.';
    end if;
    v_offer_title := v_offer.title;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_count := v_count + 1;
    if coalesce(v_item->>'productId','') = '' then raise exception 'Invalid product.'; end if;
    if (v_item->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity.'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Quantity must be between 1 and 50.'; end if;
    select * into v_product from public.products
      where id = (v_item->>'productId')::uuid and restaurant_id = p_restaurant_id
      for share;
    if not found or not v_product.is_available then
      raise exception 'A menu item is no longer available. Refresh the menu.';
    end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
      raise exception 'Not enough stock for %.', v_product.name;
    end if;
    v_variant_name := nullif(trim(coalesce(v_item->>'variantName','')), '');
    if jsonb_typeof(v_product.variants) = 'array' and jsonb_array_length(v_product.variants) > 0 then
      if v_variant_name is null then raise exception 'Please select a size for %.', v_product.name; end if;
      select value into v_variant
      from jsonb_array_elements(v_product.variants)
      where lower(trim(value->>'name')) = lower(v_variant_name)
        and coalesce((value->>'is_available')::boolean, true) = true
      limit 1;
      if v_variant is null then raise exception 'Selected size is no longer available. Refresh the menu.'; end if;
      v_unit_price := (v_variant->>'price')::numeric;
      if v_unit_price <= 0 then raise exception 'Invalid price for selected size.'; end if;
    else
      if v_variant_name is not null then raise exception 'This product does not have size options.'; end if;
      v_unit_price := v_product.price;
    end if;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
    if p_offer_id is not null and v_offer.scope = 'products'
       and v_product.id = any(v_offer.product_ids) then
      v_eligible_subtotal := v_eligible_subtotal + v_unit_price * v_qty;
    end if;
  end loop;

  if p_offer_id is not null then
    if v_subtotal < coalesce(v_offer.min_order_amount,0) then
      raise exception 'Order does not meet the selected offer minimum.';
    end if;
    if v_offer.scope = 'order' then v_eligible_subtotal := v_subtotal; end if;
    if v_eligible_subtotal <= 0 then raise exception 'Your cart has no items eligible for this offer.'; end if;
    if v_offer.discount_type = 'percentage' then
      v_raw_discount := v_eligible_subtotal * v_offer.discount_value / 100;
    else
      v_raw_discount := v_offer.discount_value;
    end if;
    if v_offer.max_discount is not null then
      v_raw_discount := least(v_raw_discount, v_offer.max_discount);
    end if;
    v_discount_amount := round(least(v_eligible_subtotal, v_raw_discount), 2);
  end if;

  v_delivery_fee := coalesce(v_restaurant.delivery_fee,0);
  v_total := v_subtotal - v_discount_amount + v_delivery_fee + v_platform_fee;

  insert into public.orders (
    customer_id, restaurant_id, order_type, status, payment_method, payment_status,
    customer_name, customer_phone, delivery_address, notes, subtotal, discount_amount, delivery_fee, platform_fee, offer_id, offer_title, total_amount
  ) values (
    p_customer_id, p_restaurant_id, 'delivery', 'placed', 'cod', 'pending',
    trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_notes,'')),''),
    v_subtotal, v_discount_amount, v_delivery_fee, v_platform_fee,
    case when v_discount_amount > 0 then p_offer_id else null end,
    case when v_discount_amount > 0 then v_offer_title else null end,
    v_total
  ) returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'productId')::uuid and restaurant_id = p_restaurant_id;
    v_variant_name := nullif(trim(coalesce(v_item->>'variantName','')), '');
    if jsonb_typeof(v_product.variants) = 'array' and jsonb_array_length(v_product.variants) > 0 then
      select value into v_variant from jsonb_array_elements(v_product.variants)
      where lower(trim(value->>'name')) = lower(v_variant_name)
        and coalesce((value->>'is_available')::boolean, true) = true limit 1;
      if v_variant is null then raise exception 'Selected size is no longer available.'; end if;
      v_unit_price := (v_variant->>'price')::numeric;
      if v_unit_price <= 0 then raise exception 'Invalid price for selected size.'; end if;
    else v_unit_price := v_product.price; v_variant_name := null; end if;
    insert into public.order_items(order_id, product_id, product_name, variant_name, quantity, unit_price, line_total)
    values (v_order_id, v_product.id, v_product.name, v_variant_name, v_qty, v_unit_price, v_unit_price * v_qty);
  end loop;

  insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
  values (v_order_id, null, 'placed', p_customer_id, 'Customer placed COD delivery order');

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'discount_amount',v_discount_amount,'offer_title',v_offer_title,'total_amount',v_total,'status','placed','created_at',now());
end;
$$;

revoke all on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb,uuid) to service_role;


-- Tho'am QR Table Ordering + KOT
-- Apply this migration in Supabase SQL Editor after the existing schema.
-- Does not alter the normal delivery-order RPC or checkout flow.

alter table public.order_items
  add column if not exists special_instructions text;

create index if not exists orders_dine_in_kitchen_idx
  on public.orders (restaurant_id, order_type, status, created_at desc);

create or replace function public.create_qr_dine_in_order_v2(
  p_restaurant_id uuid,
  p_table_code text,
  p_notes text,
  p_items jsonb
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
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant jsonb;
  v_variant_name text;
  v_unit_price numeric(10,2);
  v_qty integer;
  v_instruction text;
  v_count integer := 0;
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
    v_count := v_count + 1;
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
    v_variant_name := nullif(trim(coalesce(v_item->>'variantName','')), '');
    if jsonb_typeof(v_product.variants) = 'array' and jsonb_array_length(v_product.variants) > 0 then
      if v_variant_name is null then raise exception 'Please select a size for %.', v_product.name; end if;
      select value into v_variant
      from jsonb_array_elements(v_product.variants)
      where lower(trim(value->>'name')) = lower(v_variant_name)
        and coalesce((value->>'is_available')::boolean, true) = true
      limit 1;
      if v_variant is null then raise exception 'Selected size is no longer available. Refresh the menu.'; end if;
      v_unit_price := (v_variant->>'price')::numeric;
    else
      if v_variant_name is not null then raise exception 'This product does not have size options.'; end if;
      v_unit_price := v_product.price;
    end if;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
  end loop;

  -- Customer identity is intentionally not collected for QR dine-in orders.
  -- Empty phone preserves compatibility with the existing NOT NULL column.
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
    v_variant_name := nullif(trim(coalesce(v_item->>'variantName','')), '');
    if jsonb_typeof(v_product.variants) = 'array' and jsonb_array_length(v_product.variants) > 0 then
      select value into v_variant from jsonb_array_elements(v_product.variants)
      where lower(trim(value->>'name')) = lower(v_variant_name)
        and coalesce((value->>'is_available')::boolean, true) = true limit 1;
      if v_variant is null then raise exception 'Selected size is no longer available.'; end if;
      v_unit_price := (v_variant->>'price')::numeric;
    else v_unit_price := v_product.price; v_variant_name := null; end if;
    insert into public.order_items (
      order_id, product_id, product_name, variant_name, quantity, unit_price,
      line_total, special_instructions
    ) values (
      v_order_id, v_product.id, v_product.name, v_variant_name, v_qty, v_unit_price,
      v_unit_price * v_qty, nullif(v_instruction,'')
    );  end loop;

  insert into public.order_status_history(order_id, old_status, new_status, note)
  values (v_order_id, null, 'placed', 'QR table order created; KOT');

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'kot_number', v_order_number,
    'total_amount', v_total + v_subtotal,
    'status', 'placed',
    'created_at', now()
  );
end;
$$;

revoke all on function public.create_qr_dine_in_order_v2(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_qr_dine_in_order_v2(uuid,text,text,jsonb)
  to service_role;

