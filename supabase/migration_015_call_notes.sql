-- Shared iOS/Web call notes. Safe to run on projects where the table and
-- policies already exist.
create table if not exists public.call_notes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.call_rooms(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note       text not null,
  summary    text,
  with_names text not null default '',
  created_at timestamptz not null default now()
);

alter table public.call_notes add column if not exists summary text;
alter table public.call_notes add column if not exists with_names text not null default '';
create index if not exists call_notes_room_created_idx on public.call_notes(room_id, created_at desc);
alter table public.call_notes enable row level security;

-- PostgreSQL combines permissive policies with OR, then applies restrictive
-- policies with AND. Both policies are intentionally required here: all
-- authenticated employees share the notes, while inactive accounts remain
-- blocked everywhere.
drop policy if exists authenticated_all on public.call_notes;
create policy authenticated_all on public.call_notes
  as permissive for all to authenticated
  using (true)
  with check (true);

drop policy if exists active_employee_only on public.call_notes;
create policy active_employee_only on public.call_notes
  as restrictive for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());
