-- Journal: per-user daily log (call notes, lead-feedback updates, manual task
-- reminders). Unlike call_logs/meetings, this is personal — visible only to
-- its owner (or admin) — since it's each employee's own daily journal, not a
-- shared per-contact record.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null default 'task' check (kind in ('call_note','task','lead_update')),
  title text not null default '',
  note text not null default '',
  due_at timestamptz,
  completed boolean not null default false,
  linked_contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists journal_entries_owner_created_idx on public.journal_entries(owner_id, created_at desc);
create index if not exists journal_entries_owner_due_idx on public.journal_entries(owner_id, due_at) where due_at is not null;

alter table public.journal_entries enable row level security;
drop policy if exists active_employee_only on public.journal_entries;
drop policy if exists journal_entries_select on public.journal_entries;
drop policy if exists journal_entries_insert on public.journal_entries;
drop policy if exists journal_entries_update on public.journal_entries;
drop policy if exists journal_entries_delete on public.journal_entries;
create policy journal_entries_select on public.journal_entries for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy journal_entries_insert on public.journal_entries for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy journal_entries_update on public.journal_entries for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy journal_entries_delete on public.journal_entries for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

alter table public.journal_entries replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'journal_entries'
  ) then
    execute 'alter publication supabase_realtime add table public.journal_entries';
  end if;
end $$;

notify pgrst, 'reload schema';
