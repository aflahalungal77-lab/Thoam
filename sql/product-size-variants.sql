-- Tho'am product size / price options.
-- Apply this migration in Supabase SQL Editor after the existing COD and QR order migrations.
-- Existing products remain single-price products because variants defaults to an empty array.
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists variant_name text;
alter table public.products drop constraint if exists products_variants_array_check;
alter table public.products add constraint products_variants_array_check check (jsonb_typeof(variants) = 'array');

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
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2);
  v_platform_fee numeric(10,2) := 1;
  v_total numeric(10,2);
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
    else
      if v_variant_name is not null then raise exception 'This product does not have size options.'; end if;
      v_unit_price := v_product.price;
    end if;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
  end loop;

  v_delivery_fee := coalesce(v_restaurant.delivery_fee,0);
  v_total := v_subtotal + v_delivery_fee + v_platform_fee;

  insert into public.orders (
    customer_id, restaurant_id, order_type, status, payment_method, payment_status,
    customer_name, customer_phone, delivery_address, notes, subtotal, delivery_fee, platform_fee, total_amount
  ) values (
    p_customer_id, p_restaurant_id, 'delivery', 'placed', 'cod', 'pending',
    trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address), nullif(trim(coalesce(p_notes,'')),''),
    v_subtotal, v_delivery_fee, v_platform_fee, v_total
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
    else v_unit_price := v_product.price; v_variant_name := null; end if;
    insert into public.order_items(order_id, product_id, product_name, variant_name, quantity, unit_price, line_total)
    values (v_order_id, v_product.id, v_product.name, v_variant_name, v_qty, v_unit_price, v_unit_price * v_qty);
  end loop;

  insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
  values (v_order_id, null, 'placed', p_customer_id, 'Customer placed COD delivery order');

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total_amount',v_total,'status','placed','created_at',now());
end;
$$;

revoke all on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb) to service_role;


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
set search_path = public
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

