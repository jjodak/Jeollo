begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '여행자' check (char_length(display_name) between 1 and 80),
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.user_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  age boolean not null check (age),
  terms boolean not null check (terms),
  privacy boolean not null check (privacy),
  location boolean not null default false,
  marketing boolean not null default false,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
create table if not exists public.user_stamps (
  user_id uuid not null references auth.users(id) on delete cascade,
  heritage_id text not null references public.heritages(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, heritage_id)
);
create table if not exists public.user_scans (
  user_id uuid not null references auth.users(id) on delete cascade,
  heritage_id text not null references public.heritages(id) on delete cascade,
  first_scanned_at timestamptz not null default now(),
  primary key (user_id, heritage_id)
);

create or replace function public.create_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'full_name',''), '여행자'), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists jeollo_create_member_profile on auth.users;
create trigger jeollo_create_member_profile after insert on auth.users
for each row execute function public.create_member_profile();
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(raw_user_meta_data->>'display_name',''),
  nullif(raw_user_meta_data->>'full_name',''), '여행자'), 80) from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.user_stamps enable row level security;
alter table public.user_scans enable row level security;
revoke all on public.profiles, public.user_consents, public.user_stamps, public.user_scans from anon, authenticated;
grant select on public.profiles, public.user_consents, public.user_stamps, public.user_scans to authenticated;
grant update (display_name, notifications_enabled) on public.profiles to authenticated;
grant all on public.profiles, public.user_consents, public.user_stamps, public.user_scans to service_role;

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists consents_own_read on public.user_consents;
create policy consents_own_read on public.user_consents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists stamps_own_read on public.user_stamps;
create policy stamps_own_read on public.user_stamps for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists scans_own_read on public.user_scans;
create policy scans_own_read on public.user_scans for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.accept_member_consents(
  p_version text, p_age boolean, p_terms boolean, p_privacy boolean,
  p_location boolean default false, p_marketing boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_version is distinct from '2026-10-01' or p_age is distinct from true
    or p_terms is distinct from true or p_privacy is distinct from true then
    raise exception 'Required consents missing';
  end if;
  insert into public.user_consents (user_id, version, age, terms, privacy, location, marketing)
  values (auth.uid(), p_version, p_age, p_terms, p_privacy, coalesce(p_location,false), coalesce(p_marketing,false))
  on conflict (user_id, version) do nothing;
end;
$$;

-- Guest import is atomic and idempotent. Unknown/deleted heritage IDs are skipped.
-- Account IDs are always obtained from the verified JWT, never from caller input.
create or replace function public.save_member_stamps(p_items jsonb, p_expected_user uuid, p_scanned boolean default false)
returns setof public.user_stamps language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or v_user is distinct from p_expected_user or not exists (select 1 from public.user_consents
    where user_id = v_user and version = '2026-10-01' and age and terms and privacy) then
    raise exception 'Required consents missing';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 10000 then
    raise exception 'Invalid stamp collection';
  end if;
  insert into public.user_stamps (user_id, heritage_id, acquired_at)
  select v_user, h.id, least(coalesce((i->>'acquiredAt')::timestamptz, now()), now())
  from jsonb_array_elements(p_items) i join public.heritages h on h.id = i->>'id'
  on conflict (user_id, heritage_id) do update
    set acquired_at = least(public.user_stamps.acquired_at, excluded.acquired_at);
  if p_scanned then
    insert into public.user_scans (user_id, heritage_id, first_scanned_at)
    select v_user, h.id, least(coalesce((i->>'acquiredAt')::timestamptz, now()), now())
    from jsonb_array_elements(p_items) i join public.heritages h on h.id = i->>'id'
    on conflict (user_id, heritage_id) do update
      set first_scanned_at = least(public.user_scans.first_scanned_at, excluded.first_scanned_at);
  end if;
  return query select s.* from public.user_stamps s where s.user_id = v_user
    and s.heritage_id in (select i->>'id' from jsonb_array_elements(p_items) i) order by s.acquired_at desc;
end;
$$;
revoke all on function public.create_member_profile() from public, anon, authenticated;
revoke all on function public.accept_member_consents(text,boolean,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.save_member_stamps(jsonb,uuid,boolean) from public, anon;
grant execute on function public.accept_member_consents(text,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.save_member_stamps(jsonb,uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
