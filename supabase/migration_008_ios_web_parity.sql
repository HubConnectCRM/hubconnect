-- HubConnect migration 008 — iOS/Web feature parity
-- Run once in the Supabase SQL editor. Safe to re-run.

-- Event planning fields used by both clients.
alter table events add column if not exists status text not null default 'planning'
  check (status in ('planning','open','confirmed','cancelled','completed'));
alter table events add column if not exists prospect_number integer not null default 100;
alter table events add column if not exists venue_name text;

-- Lead workspaces can be reviewed and linked to an event.
alter table lead_files add column if not exists linked_event_id uuid references events(id) on delete set null;
alter table lead_files add column if not exists status text not null default 'draft'
  check (status in ('draft','ready','approved'));
alter table lead_files add column if not exists approval_status text not null default 'draft'
  check (approval_status in ('draft','ready','approved'));
alter table lead_files add column if not exists approved_at timestamptz;
alter table lead_files add column if not exists approved_by uuid references profiles(id) on delete set null;

-- Real pipeline fields (replaces parsing T90/T70/T50 out of notes).
alter table lead_contacts add column if not exists probability text not null default 'T50'
  check (lower(probability) in ('t90','t70','t50'));
alter table lead_contacts add column if not exists reconnect_at timestamptz;
alter table lead_contacts add column if not exists next_step text;
alter table lead_contacts add column if not exists estimated_value numeric not null default 0;
alter table lead_contacts add column if not exists owner_id uuid references profiles(id) on delete set null;
create index if not exists lead_contacts_reconnect_idx on lead_contacts(owner_id, reconnect_at)
  where reconnect_at is not null;

-- Event guest and event-day accreditation state.
alter table event_registrations add column if not exists participant_type text not null default 'guest'
  check (participant_type in ('guest','speaker','reserved_seat','staff'));
alter table event_registrations add column if not exists badge_status text not null default 'exists'
  check (badge_status in ('exists','missing','no_badge'));
alter table event_registrations add column if not exists arrived boolean not null default false;
alter table event_registrations add column if not exists checked_in_by uuid references profiles(id) on delete set null;
alter table event_registrations add column if not exists checked_in_at timestamptz;
alter table event_registrations add column if not exists last_contacted_at timestamptz;
alter table event_registrations add column if not exists last_contacted_note text;
alter table event_registrations drop constraint if exists event_registrations_rsvp_check;
alter table event_registrations add constraint event_registrations_rsvp_check
  check (rsvp is null or rsvp in ('yes','no','maybe','pending'));
create index if not exists event_reg_accreditation_idx
  on event_registrations(event_id, arrived, badge_status);

-- Calls logged from the iPhone or browser contact centre.
create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null default auth.uid(),
  interaction_type text not null default 'Telefon',
  outcome text,
  note text,
  created_at timestamptz not null default now()
);
alter table call_logs add column if not exists user_id uuid references profiles(id) on delete set null default auth.uid();
alter table call_logs add column if not exists logged_by uuid references profiles(id) on delete set null;
create index if not exists call_logs_contact_idx on call_logs(contact_id, created_at desc);
alter table call_logs enable row level security;
drop policy if exists call_logs_select on call_logs;
create policy call_logs_select on call_logs for select to authenticated using (true);
drop policy if exists call_logs_insert on call_logs;
create policy call_logs_insert on call_logs for insert to authenticated with check (true);
drop policy if exists call_logs_update on call_logs;
create policy call_logs_update on call_logs for update to authenticated using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
drop policy if exists call_logs_delete on call_logs;
create policy call_logs_delete on call_logs for delete to authenticated using (user_id = auth.uid() or is_admin());

-- Explicit contact hand-off between team members.
create table if not exists contact_shares (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  shared_by uuid references profiles(id) on delete set null default auth.uid(),
  shared_with uuid not null references profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique(contact_id, shared_with)
);
alter table contact_shares enable row level security;
drop policy if exists contact_shares_select on contact_shares;
create policy contact_shares_select on contact_shares for select to authenticated using (true);
drop policy if exists contact_shares_insert on contact_shares;
create policy contact_shares_insert on contact_shares for insert to authenticated with check (true);
drop policy if exists contact_shares_delete on contact_shares;
create policy contact_shares_delete on contact_shares for delete to authenticated using (shared_by = auth.uid() or is_admin());

-- Internal employee invitation codes. The employee-register Edge Function consumes them.
create table if not exists employee_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  email text,
  role user_role not null default 'sales',
  created_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table employee_invites enable row level security;
drop policy if exists employee_invites_admin on employee_invites;
create policy employee_invites_admin on employee_invites for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function create_employee_invite(p_email text default null, p_role user_role default 'sales', p_days integer default 14)
returns text language plpgsql security definer set search_path = public as $$
declare generated_code text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  generated_code := 'HUB-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into employee_invites(code, email, role, created_by, expires_at)
  values (generated_code, nullif(lower(trim(p_email)), ''), p_role, auth.uid(), now() + make_interval(days => greatest(1, p_days)));
  return generated_code;
end $$;
grant execute on function create_employee_invite(text, user_role, integer) to authenticated;

-- MailBos connection metadata and iPhone notification devices.
alter table profiles add column if not exists mailbos_api_key_enc text;
alter table profiles add column if not exists mailbos_sender_email text;

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  device_token text not null,
  environment text not null default 'production',
  updated_at timestamptz not null default now()
);
create unique index if not exists push_tokens_user_device_idx on push_tokens(user_id, device_token);
alter table push_tokens enable row level security;
drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens for all to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- Browser accreditation updates should appear on every check-in desk immediately.
alter table event_registrations replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_registrations'
  ) then
    alter publication supabase_realtime add table event_registrations;
  end if;
end $$;
