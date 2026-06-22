-- HubConnect — full database schema (Supabase / PostgreSQL)
-- Run this in the Supabase SQL editor on a fresh project.
-- Idempotent-ish: safe enough to re-run during early development.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'sales', 'event');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interaction_type as enum ('call', 'email', 'meeting', 'message', 'note', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_reg_status as enum (
    'desiderata', 'invited', 'registered', 'waiting_list',
    'confirmed', 'declined', 'attended', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_stage as enum (
    'prospect', 'contacted', 'in_progress', 'proposal', 'won', 'lost', 'declined'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- normalize text for dedup matching (lowercase + trimmed)
create or replace function norm(t text)
returns text language sql immutable as $$
  select nullif(lower(btrim(t)), '');
$$;

-- ---------------------------------------------------------------------------
-- profiles  (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'sales',
  language    text not null default 'en',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- auto-create a profile row when a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_normalized text generated always as (nullif(lower(btrim(name)), '')) stored,
  sector          text,
  country         text,
  city            text,
  website         text,
  overview        text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists companies_name_norm_idx on companies (name_normalized);
drop trigger if exists trg_companies_updated on companies;
create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table if not exists contacts (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references companies(id) on delete set null,
  first_name       text,
  last_name        text,
  full_name        text generated always as (btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) stored,
  job_title        text,
  email            text,
  email_normalized text generated always as (nullif(lower(btrim(email)), '')) stored,
  secondary_email  text,
  phone            text,
  linkedin         text,
  country          text,
  city             text,
  source           text,
  owner_id         uuid references profiles(id),
  gdpr_consent     boolean not null default false,
  gdpr_consent_date date,
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists contacts_company_idx on contacts (company_id);
create index if not exists contacts_owner_idx on contacts (owner_id);
create index if not exists contacts_email_norm_idx on contacts (email_normalized);
create index if not exists contacts_fullname_idx on contacts (lower(full_name));
drop trigger if exists trg_contacts_updated on contacts;
create trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  start_date  date,
  end_date    date,
  description text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- interactions  (per-contact timeline: the activity history)
-- ---------------------------------------------------------------------------
create table if not exists interactions (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references contacts(id) on delete cascade,
  user_id       uuid references profiles(id),
  event_id      uuid references events(id) on delete set null,
  type          interaction_type not null default 'note',
  topic         text,
  action_text   text,
  next_step     text,
  next_step_due date,
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists interactions_contact_idx on interactions (contact_id);
create index if not exists interactions_nextdue_idx on interactions (next_step_due) where next_step_due is not null;

-- ---------------------------------------------------------------------------
-- event_registrations  (the sales <-> event bridge)
-- ---------------------------------------------------------------------------
create table if not exists event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  status        event_reg_status not null default 'desiderata',
  requested_by  uuid references profiles(id),
  response_date date,
  gdpr_consent  boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (event_id, contact_id)
);
create index if not exists event_reg_event_idx on event_registrations (event_id);
create index if not exists event_reg_contact_idx on event_registrations (contact_id);
drop trigger if exists trg_event_reg_updated on event_registrations;
create trigger trg_event_reg_updated before update on event_registrations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- deals  (pipeline / opportunities + services)
-- ---------------------------------------------------------------------------
create table if not exists deals (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  event_id    uuid references events(id) on delete set null,
  owner_id    uuid references profiles(id),
  stage       deal_stage not null default 'prospect',
  services    text[] not null default '{}',
  offer_value numeric,
  currency    text not null default 'EUR',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists deals_company_idx on deals (company_id);
drop trigger if exists trg_deals_updated on deals;
create trigger trg_deals_updated before update on deals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log  (records every change: who, when, what)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          bigserial primary key,
  user_id     uuid,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz not null default now()
);
create index if not exists audit_table_record_idx on audit_log (table_name, record_id);
create index if not exists audit_changed_idx on audit_log (changed_at desc);

create or replace function audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec_id uuid;
begin
  if (tg_op = 'DELETE') then
    rec_id := old.id;
    insert into audit_log(user_id, table_name, record_id, action, old_data, new_data)
    values (auth.uid(), tg_table_name, rec_id, tg_op, to_jsonb(old), null);
    return old;
  else
    rec_id := new.id;
    insert into audit_log(user_id, table_name, record_id, action, old_data, new_data)
    values (auth.uid(), tg_table_name, rec_id, tg_op,
            case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
            to_jsonb(new));
    return new;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','contacts','events','interactions','event_registrations','deals']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on %1$s;', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on %1$s for each row execute function audit_row();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Internal shared CRM: every authenticated, active user sees the whole pool.
-- Writes allowed for authenticated users; deletes restricted to admin.
-- ---------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table companies           enable row level security;
alter table contacts            enable row level security;
alter table events              enable row level security;
alter table interactions        enable row level security;
alter table event_registrations enable row level security;
alter table deals               enable row level security;
alter table audit_log           enable row level security;

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
drop policy if exists profiles_admin_all on profiles;
create policy profiles_admin_all on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- generic data tables: read all / write all (authenticated) / delete admin
do $$
declare t text;
begin
  foreach t in array array['companies','contacts','events','interactions','event_registrations','deals']
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format('create policy %1$s_select on %1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_insert on %1$s;', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (true);', t);
    execute format('drop policy if exists %1$s_update on %1$s;', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (true) with check (true);', t);
    execute format('drop policy if exists %1$s_delete on %1$s;', t);
    execute format('create policy %1$s_delete on %1$s for delete to authenticated using (is_admin());', t);
  end loop;
end $$;

-- audit_log: admins read, nobody writes via API (only the trigger, which is security definer)
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select to authenticated using (is_admin());
