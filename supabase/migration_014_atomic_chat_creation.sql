-- Create a custom chat and all initial memberships in one transaction.
-- This prevents orphan groups when a second membership insert fails.

create or replace function public.create_chat_group(
  p_name text,
  p_member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  gid uuid := gen_random_uuid();
  clean_name text := nullif(btrim(p_name), '');
begin
  if uid is null or not exists (
    select 1 from public.profiles where id = uid and is_active = true
  ) then
    raise exception 'active_user_required';
  end if;

  if clean_name is null then
    raise exception 'name_required';
  end if;

  insert into public.chat_groups (id, name, kind, created_by)
  values (gid, clean_name, 'custom', uid);

  insert into public.chat_group_members (group_id, user_id, is_admin)
  values (gid, uid, true);

  insert into public.chat_group_members (group_id, user_id, is_admin)
  select gid, p.id, false
  from public.profiles p
  where p.is_active = true
    and p.id <> uid
    and p.id = any(coalesce(p_member_ids, '{}'::uuid[]))
  on conflict (group_id, user_id) do nothing;

  if not exists (
    select 1 from public.chat_group_members where group_id = gid and user_id <> uid
  ) then
    raise exception 'member_required';
  end if;

  return gid;
end;
$$;

revoke all on function public.create_chat_group(text, uuid[]) from public;
grant execute on function public.create_chat_group(text, uuid[]) to authenticated;
