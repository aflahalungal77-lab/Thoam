-- Tho'am QR short-code billing sessions.
-- Same table's repeat QR orders share one open session until owner closes it.
create table if not exists public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  billing_code varchar(4) not null check (billing_code ~ '^[A-Z0-9]{2}[0-9]{2}$'),
  status text not null default 'open' check (status in ('open','billed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists order_sessions_open_code_uidx on public.order_sessions (restaurant_id, billing_code) where status = 'open';
create unique index if not exists order_sessions_one_open_table_uidx on public.order_sessions (restaurant_id, table_id) where status = 'open';
create index if not exists order_sessions_restaurant_status_created_idx on public.order_sessions (restaurant_id, status, created_at desc);
alter table public.orders add column if not exists session_id uuid references public.order_sessions(id) on delete set null;
create index if not exists orders_session_created_idx on public.orders (session_id, created_at asc) where session_id is not null;
alter table public.order_sessions enable row level security;
drop policy if exists "order sessions owner read" on public.order_sessions;
create policy "order sessions owner read" on public.order_sessions for select to authenticated using (restaurant_id = public.current_restaurant_id() or public.current_role() = 'admin');
drop policy if exists "order sessions owner update" on public.order_sessions;
create policy "order sessions owner update" on public.order_sessions for update to authenticated using (restaurant_id = public.current_restaurant_id() or public.current_role() = 'admin') with check (restaurant_id = public.current_restaurant_id() or public.current_role() = 'admin');
grant select, update on public.order_sessions to authenticated;

create or replace function public.create_qr_dine_in_order_v4(
  p_restaurant_id uuid,
  p_table_code text,
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
  v_table public.restaurant_tables%rowtype;
  v_order_id uuid;
  v_session_id uuid;
  v_billing_code text;
  v_code_prefix text;
  v_code_attempt integer := 0;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_offer public.offers%rowtype;
  v_offer_title text := null;
  v_discount_amount numeric(10,2) := 0;
  v_eligible_subtotal numeric(10,2) := 0;
  v_raw_discount numeric(10,2) := 0;
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
  for update;
  if not found then raise exception 'This table QR code is inactive or invalid.'; end if;

  if p_offer_id is not null then
    select * into v_offer
    from public.offers
    where id = p_offer_id
      and restaurant_id = p_restaurant_id
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    for share;
    if not found then raise exception 'Selected offer is no longer available.'; end if;
    if coalesce(v_offer.discount_value, 0) <= 0
       or (v_offer.discount_type = 'percentage' and v_offer.discount_value > 100) then
      raise exception 'Selected offer has an invalid discount configuration.';
    end if;
    v_offer_title := v_offer.title;
  end if;

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
    if p_offer_id is not null and v_offer.scope = 'products'
       and v_product.id = any(coalesce(v_offer.product_ids, array[]::uuid[])) then
      v_eligible_subtotal := v_eligible_subtotal + v_unit_price * v_qty;
    end if;
  end loop;

  if p_offer_id is not null then
    if v_subtotal < coalesce(v_offer.min_order_amount, 0) then
      raise exception 'Order does not meet the selected offer minimum.';
    end if;
    if v_offer.scope = 'order' then
      v_eligible_subtotal := v_subtotal;
    end if;
    if v_eligible_subtotal <= 0 then
      raise exception 'Your cart has no items eligible for this offer.';
    end if;
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

  v_total := v_subtotal - v_discount_amount;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text, 0));

  select id, billing_code into v_session_id, v_billing_code
  from public.order_sessions
  where restaurant_id = p_restaurant_id and table_id = v_table.id and status = 'open'
  order by created_at desc limit 1 for update;

  if v_session_id is null then
    v_code_prefix := left(upper(regexp_replace(coalesce(v_restaurant.name, ''), '[^[:alnum:]]', '', 'g')), 2);
    if length(v_code_prefix) < 2 then
      v_code_prefix := rpad(coalesce(nullif(v_code_prefix, ''), 'RE'), 2, 'X');
    end if;
    loop
      v_code_attempt := v_code_attempt + 1;
      if v_code_attempt > 100 then
        raise exception 'All short billing codes are currently in use. Close an existing table bill and try again.';
      end if;
      v_billing_code := v_code_prefix || lpad(floor(random() * 100)::integer::text, 2, '0');
      exit when not exists (
        select 1 from public.order_sessions
        where restaurant_id = p_restaurant_id and billing_code = v_billing_code and status = 'open'
      );
    end loop;
    insert into public.order_sessions (restaurant_id, table_id, billing_code, status)
    values (p_restaurant_id, v_table.id, v_billing_code, 'open')
    returning id into v_session_id;
  end if;

  -- Customer identity is intentionally not collected for QR dine-in orders.
  -- Empty phone preserves compatibility with the existing NOT NULL column.
  insert into public.orders (
    restaurant_id, table_id, session_id, order_type, status, payment_method, payment_status,
    customer_name, customer_phone, delivery_address, notes,
    subtotal, discount_amount, delivery_fee, platform_fee, offer_id, offer_title, total_amount
  ) values (
    p_restaurant_id, v_table.id, v_session_id, 'dine_in', 'placed', 'cod', 'pending',
    null, '', null, nullif(trim(coalesce(p_notes,'')),''),
    v_subtotal, v_discount_amount, 0, 0,
    case when v_discount_amount > 0 then p_offer_id else null end,
    case when v_discount_amount > 0 then v_offer_title else null end,
    v_total
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
    'session_id', v_session_id,
    'billing_code', v_billing_code,
    'order_number', v_order_number,
    'kot_number', v_order_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount_amount,
    'offer_title', case when v_discount_amount > 0 then v_offer_title else null end,
    'total_amount', v_total,
    'status', 'placed',
    'created_at', now()
  );
end;
$$;

revoke all on function public.create_qr_dine_in_order_v4(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_qr_dine_in_order_v4(uuid,text,text,jsonb,uuid) to service_role;
