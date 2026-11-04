-- Nearby Restaurants: restaurant map pins
-- Run once in Supabase SQL Editor before deploying this feature.
alter table public.restaurants add column if not exists latitude double precision, add column if not exists longitude double precision;
alter table public.restaurants drop constraint if exists restaurants_valid_coordinates;
alter table public.restaurants add constraint restaurants_valid_coordinates check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180));
create index if not exists restaurants_approved_location_idx on public.restaurants(status, latitude, longitude) where status='approved' and latitude is not null and longitude is not null;
