-- Permanently delete a restaurant and all dependent data in one transaction.
-- This RPC is restricted to authenticated Tho'am admins.
-- Historical orders are intentionally deleted; this operation is irreversible.

create or replace function public.admin_delete_restaurant(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null
     or not exists (
       select 1
       from public.profiles
       where id = auth.uid()
         and role = 'admin'
     ) then
    raise exception 'Admin access required'
      using errcode = '42501';
  end if;

  if p_restaurant_id is null then
    raise exception 'Restaurant ID is required';
  end if;

  perform 1
  from public.restaurants
  where id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Restaurant not found';
  end if;

  -- Remove restrictive references before deleting their parent records.
  delete from public.challenge_redemptions
  where restaurant_id = p_restaurant_id;

  delete from public.challenge_letter_events cle
  using public.orders o
  where cle.order_id = o.id
    and o.restaurant_id = p_restaurant_id;

  -- Orders are removed first; order_items and order_status_history cascade.
  delete from public.orders
  where restaurant_id = p_restaurant_id;

  -- Sessions restrict deletion of restaurant tables and restaurants.
  -- Orders referencing sessions are already gone (session_id is SET NULL).
  delete from public.order_sessions
  where restaurant_id = p_restaurant_id;

  -- Remove table-linked records explicitly before restaurant tables are cascaded.
  delete from public.table_needs
  where restaurant_id = p_restaurant_id;

  -- Products, schedules, offers, tables and challenges cascade from restaurants.
  -- Owner profiles are detached by profiles_restaurant_id_fkey ON DELETE SET NULL.
  delete from public.restaurants
  where id = p_restaurant_id;
end;
$$;

revoke all on function public.admin_delete_restaurant(uuid) from public, anon;
grant execute on function public.admin_delete_restaurant(uuid) to authenticated;
