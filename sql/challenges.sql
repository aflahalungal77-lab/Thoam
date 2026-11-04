-- Tho'am Challenges: challenge catalogue and admin-managed publishing.
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  challenge_word text not null check (char_length(regexp_replace(challenge_word, '[^a-zA-Z0-9]', '', 'g')) between 1 and 32),
  description text,
  image_url text,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','live','paused','completed')),
  reward_title text,
  reward_description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_valid_dates check (ends_at > starts_at),
  constraint challenges_image_https check (image_url is null or image_url ~ '^https://')
);
create index if not exists challenges_live_schedule_idx on public.challenges(status, starts_at, ends_at);
create index if not exists challenges_restaurant_idx on public.challenges(restaurant_id, created_at desc);
alter table public.challenges enable row level security;
drop policy if exists "Public can view live challenges" on public.challenges;
create policy "Public can view live challenges" on public.challenges for select to anon, authenticated using (status = 'live' and starts_at <= now() and ends_at >= now());
drop policy if exists "Admins can view all challenges" on public.challenges;
create policy "Admins can view all challenges" on public.challenges for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can insert challenges" on public.challenges;
create policy "Admins can insert challenges" on public.challenges for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can update challenges" on public.challenges;
create policy "Admins can update challenges" on public.challenges for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Admins can delete challenges" on public.challenges;
create policy "Admins can delete challenges" on public.challenges for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
