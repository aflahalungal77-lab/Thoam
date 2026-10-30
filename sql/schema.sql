-- Tho'am initial schema. Review before applying to a live database.
create extension if not exists pgcrypto;
create type public.user_role as enum ('customer','restaurant_owner','admin');
create type public.restaurant_status as enum ('pending','approved','rejected','suspended');
create type public.order_type as enum ('delivery','dine_in');
create type public.order_status as enum ('placed','accepted','preparing','ready','out_for_delivery','delivered','completed','rejected','cancelled');
create type public.payment_status as enum ('pending','collected','failed','refunded');
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, phone text, role public.user_role not null default 'customer', restaurant_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.restaurants (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null,
 name text not null, slug text not null unique, description text, phone text, area text, city text default 'Malappuram', address text,
 logo_url text, status public.restaurant_status not null default 'pending', is_open boolean not null default false,
 delivery_enabled boolean not null default true, qr_enabled boolean not null default false,
 delivery_fee numeric(10,2) not null default 0 check(delivery_fee>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_restaurant_id_fkey;
alter table public.profiles add constraint profiles_restaurant_id_fkey foreign key(restaurant_id) references public.restaurants(id) on delete set null;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null, description text, price numeric(10,2) not null check(price>0), category text not null default 'Other', image_url text,
 is_veg boolean not null default false, is_available boolean not null default true, stock_quantity integer check(stock_quantity is null or stock_quantity>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.restaurant_tables (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 table_code text not null, is_active boolean not null default true, created_at timestamptz not null default now(), unique(restaurant_id,table_code)
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
 customer_id uuid references auth.users(id) on delete set null, restaurant_id uuid not null references public.restaurants(id) on delete restrict,
 table_id uuid references public.restaurant_tables(id) on delete set null, order_type public.order_type not null,
 status public.order_status not null default 'placed', payment_method text not null default 'cod' check(payment_method='cod'),
 payment_status public.payment_status not null default 'pending', customer_name text, customer_phone text not null,
 delivery_address text, notes text, subtotal numeric(10,2) not null check(subtotal>=0), delivery_fee numeric(10,2) not null default 0 check(delivery_fee>=0),
 platform_fee numeric(10,2) not null default 1 check(platform_fee>=0), total_amount numeric(10,2) not null check(total_amount>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((order_type='delivery' and delivery_address is not null and table_id is null) or (order_type='dine_in' and table_id is not null))
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, product_name text not null, quantity integer not null check(quantity>0),
 unit_price numeric(10,2) not null check(unit_price>=0), line_total numeric(10,2) not null check(line_total>=0), created_at timestamptz not null default now()
);
create table if not exists public.order_status_history (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 old_status public.order_status, new_status public.order_status not null, changed_by uuid references auth.users(id) on delete set null, note text, created_at timestamptz not null default now()
);
create index if not exists products_restaurant_idx on public.products(restaurant_id,is_available);
create index if not exists orders_restaurant_created_idx on public.orders(restaurant_id,created_at desc);
create index if not exists orders_customer_created_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists restaurants_status_city_idx on public.restaurants(status,city);
-- New auth users get customer profile. Owner/admin roles must be assigned by a trusted admin process, not signup metadata.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''), 'customer') on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
-- SECURITY: helper checks database-assigned role, not client-supplied metadata.
create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.current_restaurant_id() returns uuid language sql stable security definer set search_path=public as $$ select restaurant_id from public.profiles where id=auth.uid() and role='restaurant_owner' $$;
-- Enable RLS on all app tables.
alter table public.profiles enable row level security; alter table public.restaurants enable row level security; alter table public.products enable row level security;
alter table public.restaurant_tables enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.order_status_history enable row level security;
-- Profiles: user sees own profile; admin can see all. Role assignment is not permitted by normal users via policy.
create policy "profile select self or admin" on public.profiles for select using (id=auth.uid() or public.current_role()='admin');
create policy "profile update self basic" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=public.current_role() and restaurant_id is not distinct from (select p.restaurant_id from public.profiles p where p.id=auth.uid()));
-- Public can see approved restaurants; owners see their own; admin sees all.
create policy "restaurant read public approved or own" on public.restaurants for select using(status='approved' or owner_id=auth.uid() or public.current_role()='admin');
create policy "restaurant owner insert pending" on public.restaurants for insert with check(owner_id=auth.uid() and status='pending');
create policy "restaurant owner update own" on public.restaurants for update using(owner_id=auth.uid() or public.current_role()='admin') with check(owner_id=auth.uid() or public.current_role()='admin');
create policy "restaurant admin delete" on public.restaurants for delete using(public.current_role()='admin');
create policy "products read available or owner/admin" on public.products for select using(is_available=true or restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
create policy "products owner manage" on public.products for all using(restaurant_id=public.current_restaurant_id() or public.current_role()='admin') with check(restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
create policy "tables read active" on public.restaurant_tables for select using(is_active=true or restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
create policy "tables owner manage" on public.restaurant_tables for all using(restaurant_id=public.current_restaurant_id() or public.current_role()='admin') with check(restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
-- Orders: customer sees own, owner sees their restaurant, admin sees all. Writes should go through a trusted server endpoint in production.
create policy "orders read own restaurant or admin" on public.orders for select using(customer_id=auth.uid() or restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
create policy "orders owner status update" on public.orders for update using(restaurant_id=public.current_restaurant_id() or public.current_role()='admin') with check(restaurant_id=public.current_restaurant_id() or public.current_role()='admin');
create policy "order items read via order" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or o.restaurant_id=public.current_restaurant_id() or public.current_role()='admin')));
create policy "status history read via order" on public.order_status_history for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or o.restaurant_id=public.current_restaurant_id() or public.current_role()='admin')));
-- Do not add broad public INSERT policies for orders/order_items. Implement an atomic server-side order endpoint that validates prices, restaurant, table, fees, and stock.
-- Storage bucket 'food-images' can be created in Supabase dashboard; configure authenticated owner upload policies before production.
