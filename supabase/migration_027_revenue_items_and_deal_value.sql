-- Two fixes for the Cost/Bilancino sheet:
--
-- 1. Manual revenue entries, mirroring cost_items exactly — so a sponsor
--    payment that isn't tracked as a Sales deal can still be recorded
--    directly on the Bilancino, same as a manual cost line.
create table if not exists public.revenue_items (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.events(id) on delete cascade,
  lead_file_id uuid references public.lead_files(id) on delete cascade,
  description  text not null,
  imponibile   numeric(12,2) not null default 0,
  iva          numeric(12,2) not null default 0,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint revenue_items_scope_check check (event_id is not null or lead_file_id is not null)
);

create index if not exists revenue_items_event_idx on public.revenue_items(event_id);
create index if not exists revenue_items_lead_file_idx on public.revenue_items(lead_file_id);

alter table public.revenue_items enable row level security;
drop policy if exists revenue_items_select on public.revenue_items;
create policy revenue_items_select on public.revenue_items for select to authenticated using (true);
drop policy if exists revenue_items_write on public.revenue_items;
create policy revenue_items_write on public.revenue_items for all to authenticated
  using (public.is_active_user() and public.current_user_role() in ('admin', 'sales'))
  with check (public.is_active_user() and public.current_user_role() in ('admin', 'sales'));

alter table public.revenue_items replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'revenue_items'
  ) then
    alter publication supabase_realtime add table public.revenue_items;
  end if;
end $$;

notify pgrst, 'reload schema';
