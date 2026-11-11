-- Restrict profile helper RPCs and harden SECURITY DEFINER search paths.
-- Applied to production Supabase project uiykzclzlaqlljehikru on 2026-11-11.
-- These helpers remain executable by authenticated users because existing RLS
-- policies and owner/admin UI depend on them. Anonymous execution is removed.

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.restaurant_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'restaurant_owner'
  limit 1;
$$;
revoke all on function public.current_restaurant_id() from public, anon;
grant execute on function public.current_restaurant_id() to authenticated, service_role;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated, service_role;

alter function public.admin_delete_restaurant(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.redeem_challenge_reward(uuid)
  set search_path = pg_catalog, public, pg_temp;
