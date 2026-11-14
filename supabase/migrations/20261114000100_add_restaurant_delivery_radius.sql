alter table public.restaurants
  add column if not exists delivery_radius_km numeric(5,2) not null default 5;

alter table public.restaurants
  drop constraint if exists restaurants_delivery_radius_km_check;

alter table public.restaurants
  add constraint restaurants_delivery_radius_km_check
  check (delivery_radius_km >= 1 and delivery_radius_km <= 20);
