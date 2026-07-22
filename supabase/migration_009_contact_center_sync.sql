-- HubConnect migration 009 — Contact Center + MailBos + shared calendar parity
-- Safe to run after any previous HubConnect migration. iOS and Web use these
-- exact tables/columns as their shared source of truth.

alter table public.profiles add column if not exists mailbos_api_key_enc text;
alter table public.profiles add column if not exists mailbos_sender_email text;
alter table public.profiles add column if not exists mailbos_provider text;
alter table public.profiles add column if not exists mailbos_key_id text;
alter table public.profiles add column if not exists mailbos_label text;

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  logged_by uuid references public.profiles(id) on delete set null default auth.uid(),
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  interaction_type text not null default 'Telefon',
  outcome text not null default 'answered',
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.call_logs add column if not exists logged_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.call_logs add column if not exists user_id uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.call_logs add column if not exists interaction_type text not null default 'Telefon';
alter table public.call_logs add column if not exists outcome text not null default 'answered';
alter table public.call_logs add column if not exists note text not null default '';
update public.call_logs set logged_by = coalesce(logged_by, user_id), user_id = coalesce(user_id, logged_by) where logged_by is null or user_id is null;
create index if not exists call_logs_contact_created_idx on public.call_logs(contact_id, created_at desc);
create index if not exists call_logs_user_created_idx on public.call_logs(logged_by, created_at desc);
alter table public.call_logs enable row level security;
drop policy if exists active_employee_only on public.call_logs;
drop policy if exists call_logs_select on public.call_logs;
drop policy if exists call_logs_insert on public.call_logs;
drop policy if exists call_logs_update on public.call_logs;
drop policy if exists call_logs_delete on public.call_logs;
create policy call_logs_select on public.call_logs for select to authenticated using (true);
create policy call_logs_insert on public.call_logs for insert to authenticated with check (coalesce(logged_by, user_id, auth.uid()) = auth.uid() or public.is_admin());
create policy call_logs_update on public.call_logs for update to authenticated using (coalesce(logged_by, user_id) = auth.uid() or public.is_admin()) with check (coalesce(logged_by, user_id) = auth.uid() or public.is_admin());
create policy call_logs_delete on public.call_logs for delete to authenticated using (coalesce(logged_by, user_id) = auth.uid() or public.is_admin());

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  meeting_link text not null default '',
  location text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists meetings_owner_start_idx on public.meetings(owner_id, start_at);
create index if not exists meetings_contact_idx on public.meetings(contact_id, start_at);
alter table public.meetings enable row level security;
drop policy if exists active_employee_only on public.meetings;
drop policy if exists meetings_select on public.meetings;
drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_delete on public.meetings;
create policy meetings_select on public.meetings for select to authenticated using (true);
create policy meetings_insert on public.meetings for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy meetings_update on public.meetings for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy meetings_delete on public.meetings for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

create table if not exists public.contact_shares (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  shared_by uuid references public.profiles(id) on delete set null default auth.uid(),
  shared_with uuid not null references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists contact_shares_contact_recipient_idx on public.contact_shares(contact_id, shared_with);
alter table public.contact_shares enable row level security;
drop policy if exists contact_shares_select on public.contact_shares;
drop policy if exists contact_shares_insert on public.contact_shares;
drop policy if exists contact_shares_delete on public.contact_shares;
create policy contact_shares_select on public.contact_shares for select to authenticated using (true);
create policy contact_shares_insert on public.contact_shares for insert to authenticated with check (coalesce(shared_by, auth.uid()) = auth.uid() or public.is_admin());
create policy contact_shares_delete on public.contact_shares for delete to authenticated using (shared_by = auth.uid() or shared_with = auth.uid() or public.is_admin());

-- CRM mail archive. Live inbox/sent/open/reply data is read from MailBos, while
-- this table links outgoing messages to HubConnect contacts, companies and deals.
create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text,
  direction text not null default 'sent',
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  sent_at timestamptz,
  received_at timestamptz,
  body_preview text,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  needs_followup boolean not null default false,
  replied boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.mail_messages add column if not exists provider_message_id text;
alter table public.mail_messages add column if not exists direction text not null default 'sent';
alter table public.mail_messages add column if not exists from_email text;
alter table public.mail_messages add column if not exists to_emails text[] not null default '{}';
alter table public.mail_messages add column if not exists cc_emails text[] not null default '{}';
alter table public.mail_messages add column if not exists sent_at timestamptz;
alter table public.mail_messages add column if not exists received_at timestamptz;
alter table public.mail_messages add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.mail_messages add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.mail_messages add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.mail_messages add column if not exists deal_id uuid references public.deals(id) on delete set null;
alter table public.mail_messages add column if not exists needs_followup boolean not null default false;
alter table public.mail_messages add column if not exists replied boolean not null default false;
alter table public.mail_messages add column if not exists opened boolean not null default false;
alter table public.mail_messages add column if not exists tracking_id text;
alter table public.mail_messages add column if not exists provider text not null default 'mailbos';
alter table public.mail_messages add column if not exists user_id uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.mail_messages add column if not exists to_email text;
update public.mail_messages
set provider_message_id = coalesce(provider_message_id, tracking_id, id::text),
    direction = coalesce(direction, 'sent'),
    to_emails = case when cardinality(to_emails) = 0 and to_email is not null then array[to_email] else to_emails end,
    sent_at = coalesce(sent_at, created_at)
where provider_message_id is null or sent_at is null or cardinality(to_emails) = 0;
create index if not exists mail_messages_contact_sent_idx on public.mail_messages(contact_id, sent_at desc);
create index if not exists mail_messages_provider_id_idx on public.mail_messages(provider_message_id);
alter table public.mail_messages enable row level security;
drop policy if exists "auth read mail messages" on public.mail_messages;
drop policy if exists "auth write mail messages" on public.mail_messages;
drop policy if exists mail_messages_select on public.mail_messages;
drop policy if exists mail_messages_insert on public.mail_messages;
drop policy if exists mail_messages_update on public.mail_messages;
create policy mail_messages_select on public.mail_messages for select to authenticated using (true);
create policy mail_messages_insert on public.mail_messages for insert to authenticated with check (coalesce(user_id, auth.uid()) = auth.uid() or public.is_admin());
create policy mail_messages_update on public.mail_messages for update to authenticated using (coalesce(user_id, auth.uid()) = auth.uid() or public.is_admin()) with check (coalesce(user_id, auth.uid()) = auth.uid() or public.is_admin());

-- Make changes immediately available to clients that subscribe to Supabase Realtime.
alter table public.call_logs replica identity full;
alter table public.meetings replica identity full;
alter table public.mail_messages replica identity full;
do $$
declare table_name text;
begin
  foreach table_name in array array['call_logs', 'meetings', 'mail_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
