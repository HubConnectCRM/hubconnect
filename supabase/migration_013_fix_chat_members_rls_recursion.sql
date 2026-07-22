-- Fix: policies on chat_group_members must not SELECT chat_group_members
-- directly, otherwise PostgreSQL recursively evaluates the same RLS policy.

create or replace function public.can_access_chat_group(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.chat_group_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_chat_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.chat_group_members m
    where m.group_id = gid and m.user_id = auth.uid() and m.is_admin
  );
$$;

drop policy if exists chat_group_members_select on public.chat_group_members;
create policy chat_group_members_select
on public.chat_group_members
for select to authenticated
using (user_id = auth.uid() or public.can_access_chat_group(group_id));

drop policy if exists chat_group_members_delete on public.chat_group_members;
create policy chat_group_members_delete
on public.chat_group_members
for delete to authenticated
using (user_id = auth.uid() or public.can_access_chat_group(group_id));

drop policy if exists chat_read_state_select_fellow_members on public.chat_read_state;
create policy chat_read_state_select_fellow_members
on public.chat_read_state
for select to authenticated
using (public.can_access_chat_group(group_id));

grant execute on function public.can_access_chat_group(uuid) to authenticated;
grant execute on function public.is_chat_group_admin(uuid) to authenticated;
