alter table public.products
  add column if not exists taste_tags text[] not null default '{}',
  add column if not exists cuisine_type text;

create index if not exists products_cravings_taste_tags_gin_idx
  on public.products using gin (taste_tags);

create index if not exists products_cravings_cuisine_type_idx
  on public.products (cuisine_type);

comment on column public.products.taste_tags is
  'Taste descriptors used by the Find Your Cravings recommendation experience.';
comment on column public.products.cuisine_type is
  'Cuisine identifier used by the Find Your Cravings recommendation experience.';
