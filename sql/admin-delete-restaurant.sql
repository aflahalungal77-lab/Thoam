-- Permanently delete a restaurant and all dependent data in one transaction.
-- Run this migration in the Supabase SQL Editor before using the Admin Delete button.
-- Historical orders are intentionally deleted by this operation; this is irreversible.

create or replace function public.admin_delete_restaurant(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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

  -- Remove rows with RESTRICT references before deleting their parent orders.
  delete from public.challenge_redemptions
  where restaurant_id = p_restaurant_id;

  delete from public.challenge_letter_events cle
  using public.orders o
  where cle.order_id = o.id
    and o.restaurant_id = p_restaurant_id;

  -- Order items and status history cascade from orders.
  delete from public.orders
  where restaurant_id = p_restaurant_id;

  -- Products, restaurant tables and challenges cascade from restaurants.
  -- Owner profiles are detached by profiles_restaurant_id_fkey ON DELETE SET NULL.
  delete from public.restaurants
  where id = p_restaurant_id;
end;
$$;

revoke all on function public.admin_delete_restaurant(uuid) from public, anon;
grant execute on function public.admin_delete_restaurant(uuid) to authenticated;
