-- Restaurant order acceptance/rejection and customer-visible status history.
-- Apply this migration to the Tho'am Supabase project.

create or replace function public.restaurant_update_order_status(
  p_order_id uuid,
  p_new_status public.order_status
)
returns public.orders
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_restaurant_id uuid;
  v_old_status public.order_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_restaurant_id := public.current_restaurant_id();
  if v_restaurant_id is null and public.current_role() <> 'admin'::public.user_role then
    raise exception 'Restaurant account required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and (restaurant_id = v_restaurant_id or public.current_role() = 'admin'::public.user_role)
  for update;

  if not found then
    raise exception 'Order not found or access denied.';
  end if;

  v_old_status := v_order.status;
  if v_old_status = p_new_status then
    return v_order;
  end if;

  if not (
    (v_old_status = 'placed' and p_new_status in ('accepted', 'rejected')) or
    (v_old_status = 'accepted' and p_new_status in ('preparing', 'rejected')) or
    (v_old_status = 'preparing' and p_new_status = 'ready') or
    (v_old_status = 'ready' and p_new_status in ('out_for_delivery', 'delivered')) or
    (v_old_status = 'out_for_delivery' and p_new_status = 'delivered')
  ) then
    raise exception 'Invalid order status transition: % -> %.', v_old_status, p_new_status;
  end if;

  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
  values (
    p_order_id,
    v_old_status,
    p_new_status,
    auth.uid(),
    case
      when p_new_status = 'accepted' then 'Restaurant accepted the order'
      when p_new_status = 'rejected' then 'Restaurant rejected the order'
      else 'Restaurant updated order status'
    end
  );

  return v_order;
end;
$$;

drop policy if exists "status history insert by restaurant" on public.order_status_history;
create policy "status history insert by restaurant"
on public.order_status_history
for insert
to authenticated
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (
        o.restaurant_id = (select public.current_restaurant_id())
        or (select public.current_role()) = 'admin'::public.user_role
      )
  )
);

revoke all on function public.restaurant_update_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.restaurant_update_order_status(uuid, public.order_status) to authenticated;
