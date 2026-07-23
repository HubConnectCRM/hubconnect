-- Cross-device call parity for HubConnect Web + iOS.
-- Safe to run repeatedly on the shared Supabase project.

-- The iOS app stores both normal APNs and PushKit VoIP tokens here. Older
-- web migrations created the table before the token kind was introduced.
alter table public.push_tokens
  add column if not exists kind text not null default 'remote';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'push_tokens_kind_check'
      and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_kind_check check (kind in ('remote', 'voip'));
  end if;
end $$;

create index if not exists push_tokens_user_kind_idx
  on public.push_tokens(user_id, kind);

-- Restrictive active-user policies need a permissive policy to grant rows in
-- PostgreSQL. Keep both, as with call_notes: authenticated employees share
-- call state, while deactivated accounts are still blocked.
drop policy if exists authenticated_all on public.call_rooms;
create policy authenticated_all on public.call_rooms
  as permissive for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.call_room_participants;
create policy authenticated_all on public.call_room_participants
  as permissive for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all on public.call_invites;
create policy authenticated_all on public.call_invites
  as permissive for all to authenticated using (true) with check (true);

drop policy if exists active_employee_only on public.call_rooms;
create policy active_employee_only on public.call_rooms
  as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists active_employee_only on public.call_room_participants;
create policy active_employee_only on public.call_room_participants
  as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists active_employee_only on public.call_invites;
create policy active_employee_only on public.call_invites
  as restrictive for all to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create index if not exists call_invites_callee_ringing_idx
  on public.call_invites(callee_id, created_at desc)
  where status = 'ringing';

-- Room status is shared state, so keep it accurate regardless of whether the
-- participant joined from Swift or the browser.
create or replace function public.sync_call_room_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.left_at is null then
    update public.call_rooms
      set status = 'active', ended_at = null
      where id = new.room_id and status <> 'ended';
  elsif not exists (
    select 1 from public.call_room_participants
    where room_id = new.room_id and left_at is null
  ) then
    update public.call_rooms
      set status = 'ended', ended_at = coalesce(ended_at, now())
      where id = new.room_id;
    update public.call_invites
      set status = 'cancelled', responded_at = coalesce(responded_at, now())
      where room_id = new.room_id and status = 'ringing';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_call_room_status_trigger on public.call_room_participants;
create trigger sync_call_room_status_trigger
after insert or update of left_at on public.call_room_participants
for each row execute function public.sync_call_room_status();

