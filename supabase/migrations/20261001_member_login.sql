-- Existing members log in without a new consent step.
-- Keep authentication and account ownership checks; never create consent records at login.
begin;

create or replace function public.save_member_stamps(p_items jsonb, p_expected_user uuid, p_scanned boolean default false)
returns setof public.user_stamps language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or v_user is distinct from p_expected_user then
    raise exception 'Authentication required';
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

revoke all on function public.save_member_stamps (jsonb, uuid, boolean)
from public, anon;

grant
execute on function public.save_member_stamps (jsonb, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;