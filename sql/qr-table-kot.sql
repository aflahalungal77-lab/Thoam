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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 40 then
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
    v_subtotal := v_subtotal + v_product.price * v_qty;
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
