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
    v_subtotal := v_subtotal + v_product.price * v_qty;
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
    insert into public.order_items(order_id, product_id, product_name, quantity, unit_price, line_total)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_product.price, v_product.price * v_qty);
  end loop;

  insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
  values (v_order_id, null, 'placed', p_customer_id, 'Customer placed COD delivery order');

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total_amount',v_total,'status','placed','created_at',now());
end;
$$;

revoke all on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_cod_delivery_order(uuid,uuid,text,text,text,text,jsonb) to service_role;
