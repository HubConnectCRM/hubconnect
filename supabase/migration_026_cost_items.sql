-- Sales "Cost" / Bilancino sheet — matches the existing Bilancino Excel
-- template exactly: free-text cost line items (hotel, venue, catering,
-- anything) with Imponibile/IVA, scoped to either an event or a lead file
-- (same scoping deals already use). Revenue (RICAVI) is NOT stored here —
-- it's derived live from won deals for the same event/lead file, so there's
-- one source of truth instead of re-entering sponsor data twice.

create table if not exists public.cost_items (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.events(id) on delete cascade,
  lead_file_id uuid references public.lead_files(id) on delete cascade,
  description  text not null,
  imponibile   numeric(12,2) not null default 0,
  iva          numeric(12,2) not null default 0,
  paid         boolean not null default false,
  receipt_path text,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint cost_items_scope_check check (event_id is not null or lead_file_id is not null)
);

create index if not exists cost_items_event_idx on public.cost_items(event_id);
create index if not exists cost_items_lead_file_idx on public.cost_items(lead_file_id);

alter table public.cost_items enable row level security;

-- Same access rule as deals: admin or sales manage cost items, everyone
-- authenticated + active can read (matches deals_delete's "any authenticated
-- sales/admin" pattern already used for financial data in this app).
drop policy if exists cost_items_select on public.cost_items;
create policy cost_items_select on public.cost_items for select to authenticated using (true);
drop policy if exists cost_items_write on public.cost_items;
create policy cost_items_write on public.cost_items for all to authenticated
  using (public.is_active_user() and public.current_user_role() in ('admin', 'sales'))
  with check (public.is_active_user() and public.current_user_role() in ('admin', 'sales'));

insert into storage.buckets (id, name, public) values ('cost-receipts', 'cost-receipts', true) on conflict (id) do nothing;
drop policy if exists cost_receipts_read on storage.objects;
create policy cost_receipts_read on storage.objects for select to authenticated using (bucket_id = 'cost-receipts');
drop policy if exists cost_receipts_insert on storage.objects;
create policy cost_receipts_insert on storage.objects for insert to authenticated with check (bucket_id = 'cost-receipts' and public.is_active_user());

alter table public.cost_items replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cost_items'
  ) then
    alter publication supabase_realtime add table public.cost_items;
  end if;
end $$;

notify pgrst, 'reload schema';
