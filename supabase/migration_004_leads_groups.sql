-- Migration 004: registration_source + lead_files + contact_groups
-- Run in Supabase SQL Editor

-- 1. Mark whether a registration was added by sales or event team
alter table event_registrations
  add column if not exists registration_source text not null default 'event'
  check (registration_source in ('sales', 'event'));

-- 2. Lead files — non-event sales pipelines
create table if not exists lead_files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

alter table lead_files enable row level security;
create policy "auth read lead_files"   on lead_files for select to authenticated using (true);
create policy "auth insert lead_files" on lead_files for insert to authenticated with check (true);
create policy "auth update lead_files" on lead_files for update to authenticated using (true);
create policy "auth delete lead_files" on lead_files for delete to authenticated using (true);

-- 3. Sub-groups (segments) within an event OR a lead file
create table if not exists contact_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  event_id     uuid references events(id) on delete cascade,
  lead_file_id uuid references lead_files(id) on delete cascade,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

alter table contact_groups enable row level security;
create policy "auth read contact_groups"   on contact_groups for select to authenticated using (true);
create policy "auth insert contact_groups" on contact_groups for insert to authenticated with check (true);
create policy "auth update contact_groups" on contact_groups for update to authenticated using (true);
create policy "auth delete contact_groups" on contact_groups for delete to authenticated using (true);

-- 4. Add group tracking to event_registrations
alter table event_registrations
  add column if not exists group_id uuid references contact_groups(id) on delete set null;

-- 5. Lead contacts — contacts inside a lead file
create table if not exists lead_contacts (
  id           uuid primary key default gen_random_uuid(),
  lead_file_id uuid not null references lead_files(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  group_id     uuid references contact_groups(id) on delete set null,
  status       text,
  notes        text,
  rsvp         text check (rsvp in ('yes','no','maybe')),
  added_by     uuid references profiles(id),
  created_at   timestamptz default now(),
  unique(lead_file_id, contact_id)
);

alter table lead_contacts enable row level security;
create policy "auth read lead_contacts"   on lead_contacts for select to authenticated using (true);
create policy "auth insert lead_contacts" on lead_contacts for insert to authenticated with check (true);
create policy "auth update lead_contacts" on lead_contacts for update to authenticated using (true);
create policy "auth delete lead_contacts" on lead_contacts for delete to authenticated using (true);
