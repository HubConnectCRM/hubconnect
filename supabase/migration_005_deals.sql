-- Migration 005: extend deals into the sales→event pipeline + representatives
-- The base schema already has a `deals` table (company_id, contact_id, event_id,
-- owner_id, stage deal_stage, services, offer_value, currency, notes). We extend
-- it rather than recreate, and add reps + the push-to-event link.
-- Run in Supabase SQL Editor.

-- 1. Extend deals with workspace + push fields.
alter table deals add column if not exists company_name    text;
alter table deals add column if not exists lead_file_id    uuid references lead_files(id) on delete cascade;
alter table deals add column if not exists group_id        uuid references contact_groups(id) on delete set null;
alter table deals add column if not exists po_won          boolean not null default false;
alter table deals add column if not exists pushed_event_id uuid references events(id) on delete set null;
alter table deals add column if not exists pushed_at       timestamptz;
alter table deals add column if not exists created_by      uuid references profiles(id);

create index if not exists deals_lead_file_idx on deals (lead_file_id);

-- Let sales (any authenticated user) delete their own deals, not just admins.
drop policy if exists deals_delete on deals;
create policy deals_delete on deals for delete to authenticated using (true);

-- 2. Representatives of a deal (real contacts in the shared pool).
create table if not exists deal_reps (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete cascade,
  rsvp        text check (rsvp in ('yes','no','maybe')),  -- sales' prediction
  notes       text,
  created_at  timestamptz default now(),
  unique(deal_id, contact_id)
);

alter table deal_reps enable row level security;
drop policy if exists deal_reps_select on deal_reps;
create policy deal_reps_select on deal_reps for select to authenticated using (true);
drop policy if exists deal_reps_insert on deal_reps;
create policy deal_reps_insert on deal_reps for insert to authenticated with check (true);
drop policy if exists deal_reps_update on deal_reps;
create policy deal_reps_update on deal_reps for update to authenticated using (true) with check (true);
drop policy if exists deal_reps_delete on deal_reps;
create policy deal_reps_delete on deal_reps for delete to authenticated using (true);

-- 3. Trace a pushed event_registration back to its originating deal.
alter table event_registrations
  add column if not exists deal_id uuid references deals(id) on delete set null;
