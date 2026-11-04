-- Tho'am Challenges production foundation.
-- Eligible orders: authenticated customer delivery orders only, marked delivered/completed
-- AND COD payment_status='collected'. QR guest and WhatsApp guest orders are excluded.
create table if not exists public.challenges (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(trim(title)) between 2 and 120),
 challenge_word text not null check (char_length(regexp_replace(upper(challenge_word), '[^A-Z0-9]', '', 'g')) between 1 and 32),
 description text,
 image_url text check (image_url is null or image_url ~ '^https://'),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'draft' check (status in ('draft','live','paused','completed')),
 reward_title text,
 reward_description text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint challenges_valid_dates check (ends_at > starts_at)
);
create index if not exists challenges_live_schedule_idx on public.challenges(status,starts_at,ends_at);
create index if not exists challenges_restaurant_idx on public.challenges(restaurant_id,created_at desc);

create table if not exists public.challenge_progress (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 progress_count integer not null default 0 check(progress_count>=0),
 collected_letters text[] not null default '{}',
 completed_at timestamptz,
 reward_status text not null default 'collecting' check(reward_status in ('collecting','ready','redeemed')),
 redeemed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(challenge_id,customer_id)
);
create index if not exists challenge_progress_customer_idx on public.challenge_progress(customer_id,updated_at desc);
create index if not exists challenge_progress_challenge_idx on public.challenge_progress(challenge_id,reward_status);

create table if not exists public.challenge_letter_events (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete restrict,
 letter_index integer not null check(letter_index>0),
 letter text not null check(char_length(letter)=1),
 created_at timestamptz not null default now(),
 unique(challenge_id,order_id),
 unique(challenge_id,customer_id,letter_index)
);
create index if not exists challenge_letter_customer_idx on public.challenge_letter_events(customer_id,challenge_id);

create table if not exists public.challenge_redemptions (
 id uuid primary key default gen_random_uuid(),
 progress_id uuid not null unique references public.challenge_progress(id) on delete restrict,
 challenge_id uuid not null references public.challenges(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete restrict,
 restaurant_id uuid not null references public.restaurants(id) on delete restrict,
 redeemed_by uuid not null references auth.users(id) on delete restrict,
 redeemed_at timestamptz not null default now()
);
create index if not exists challenge_redemptions_restaurant_idx on public.challenge_redemptions(restaurant_id,redeemed_at desc);

alter table public.challenges enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.challenge_letter_events enable row level security;
alter table public.challenge_redemptions enable row level security;

drop policy if exists "Public can view live challenges" on public.challenges;
drop policy if exists "Admins can view all challenges" on public.challenges;
drop policy if exists "Admins can insert challenges" on public.challenges;
drop policy if exists "Admins can update challenges" on public.challenges;
drop policy if exists "Admins can delete challenges" on public.challenges;
drop policy if exists "Customers view live challenges" on public.challenges;
create policy "Customers view live challenges" on public.challenges for select to anon,authenticated using(status='live' and starts_at<=now() and ends_at>=now());
drop policy if exists "Owners manage own challenges" on public.challenges;
create policy "Owners manage own challenges" on public.challenges for all to authenticated
 using (restaurant_id=(select p.restaurant_id from public.profiles p where p.id=auth.uid() and p.role='restaurant_owner'))
 with check (restaurant_id=(select p.restaurant_id from public.profiles p where p.id=auth.uid() and p.role='restaurant_owner'));

drop policy if exists "Customers read own challenge progress" on public.challenge_progress;
create policy "Customers read own challenge progress" on public.challenge_progress for select to authenticated using(customer_id=auth.uid());
drop policy if exists "Owners read own challenge progress" on public.challenge_progress;
create policy "Owners read own challenge progress" on public.challenge_progress for select to authenticated using(exists(select 1 from public.challenges c join public.profiles p on p.restaurant_id=c.restaurant_id where c.id=challenge_id and p.id=auth.uid() and p.role='restaurant_owner'));
drop policy if exists "Customers read own letter events" on public.challenge_letter_events;
create policy "Customers read own letter events" on public.challenge_letter_events for select to authenticated using(customer_id=auth.uid());
drop policy if exists "Owners read own letter events" on public.challenge_letter_events;
create policy "Owners read own letter events" on public.challenge_letter_events for select to authenticated using(exists(select 1 from public.challenges c join public.profiles p on p.restaurant_id=c.restaurant_id where c.id=challenge_id and p.id=auth.uid() and p.role='restaurant_owner'));
drop policy if exists "Customers read own redemptions" on public.challenge_redemptions;
create policy "Customers read own redemptions" on public.challenge_redemptions for select to authenticated using(customer_id=auth.uid());
drop policy if exists "Owners read own redemptions" on public.challenge_redemptions;
create policy "Owners read own redemptions" on public.challenge_redemptions for select to authenticated using(restaurant_id=(select p.restaurant_id from public.profiles p where p.id=auth.uid() and p.role='restaurant_owner'));

-- Atomically award one next required character per eligible order.
create or replace function public.award_challenge_letters_for_order()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; v_word text; v_next integer; v_letter text; v_progress public.challenge_progress%rowtype;
begin
 if new.customer_id is null
    or new.order_type <> 'delivery'
    or new.payment_status <> 'collected'
    or new.status not in ('delivered','completed')
    or (tg_op='UPDATE' and old.status in ('delivered','completed') and old.payment_status='collected') then
   return new;
 end if;
 for c in
   select * from public.challenges
   where restaurant_id=new.restaurant_id and status='live'
     and starts_at<=new.created_at and ends_at>=new.created_at
   order by created_at,id
 loop
   perform pg_advisory_xact_lock(hashtextextended(c.id::text||':'||new.customer_id::text,0));
   v_word:=regexp_replace(upper(c.challenge_word),'[^A-Z0-9]','','g');
   insert into public.challenge_progress(challenge_id,customer_id)
   values(c.id,new.customer_id)
   on conflict(challenge_id,customer_id) do nothing;
   select * into v_progress from public.challenge_progress
    where challenge_id=c.id and customer_id=new.customer_id for update;
   if v_progress.reward_status='redeemed' or v_progress.progress_count>=char_length(v_word) then
     continue;
   end if;
   v_next:=v_progress.progress_count+1;
   v_letter:=substr(v_word,v_next,1);
   insert into public.challenge_letter_events(challenge_id,customer_id,order_id,letter_index,letter)
   values(c.id,new.customer_id,new.id,v_next,v_letter)
   on conflict(challenge_id,order_id) do nothing;
   if found then
     update public.challenge_progress
       set progress_count=v_next,
           collected_letters=array_append(collected_letters,v_letter),
           completed_at=case when v_next=char_length(v_word) then now() else null end,
           reward_status=case when v_next=char_length(v_word) then 'ready' else 'collecting' end,
           updated_at=now()
       where id=v_progress.id;
   end if;
 end loop;
 return new;
end $$;
drop trigger if exists trg_award_challenge_letters on public.orders;
create trigger trg_award_challenge_letters
after update of status,payment_status on public.orders
for each row execute function public.award_challenge_letters_for_order();

-- Owner securely confirms that a completed customer's reward was handed over.
create or replace function public.redeem_challenge_reward(p_progress_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_progress public.challenge_progress%rowtype; v_owner_restaurant uuid;
begin
 select restaurant_id into v_owner_restaurant from public.profiles
 where id=auth.uid() and role='restaurant_owner';
 if v_owner_restaurant is null then raise exception 'Restaurant owner access required'; end if;
 select cp.* into v_progress from public.challenge_progress cp
 join public.challenges c on c.id=cp.challenge_id
 where cp.id=p_progress_id and c.restaurant_id=v_owner_restaurant
 for update;
 if not found then raise exception 'Challenge progress not found for this restaurant'; end if;
 if v_progress.reward_status<>'ready' then raise exception 'Reward is not ready or has already been redeemed'; end if;
 insert into public.challenge_redemptions(progress_id,challenge_id,customer_id,restaurant_id,redeemed_by)
 values(v_progress.id,v_progress.challenge_id,v_progress.customer_id,v_owner_restaurant,auth.uid());
 update public.challenge_progress set reward_status='redeemed',redeemed_at=now(),updated_at=now()
 where id=p_progress_id;
 return jsonb_build_object('success',true,'redeemed_at',now());
end $$;
revoke all on function public.award_challenge_letters_for_order() from public,anon,authenticated;
revoke all on function public.redeem_challenge_reward(uuid) from public,anon;
grant execute on function public.redeem_challenge_reward(uuid) to authenticated;
