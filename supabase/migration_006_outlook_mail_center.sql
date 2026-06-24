-- Migration 006: Mail Center + Notification Center foundation
-- Run in Supabase SQL Editor before enabling Microsoft Outlook OAuth.

create table if not exists outlook_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  tenant_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  delta_link text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, email)
);

create table if not exists mail_messages (
  id uuid primary key default gen_random_uuid(),
  outlook_account_id uuid references outlook_accounts(id) on delete cascade,
  provider_message_id text not null,
  conversation_id text,
  direction text not null check (direction in ('sent','received')),
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  sent_at timestamptz,
  received_at timestamptz,
  body_preview text,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  needs_followup boolean not null default false,
  replied boolean not null default false,
  created_at timestamptz not null default now(),
  unique(outlook_account_id, provider_message_id)
);

create table if not exists crm_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('follow_up_due','reply_received','unanswered_email','event_status_change')),
  title text not null,
  body text,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  mail_message_id uuid references mail_messages(id) on delete set null,
  due_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table outlook_accounts enable row level security;
alter table mail_messages enable row level security;
alter table crm_notifications enable row level security;

create policy "own outlook accounts" on outlook_accounts for all to authenticated using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy "auth read mail messages" on mail_messages for select to authenticated using (true);
create policy "auth write mail messages" on mail_messages for all to authenticated using (true) with check (true);
create policy "own notifications" on crm_notifications for all to authenticated using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

create index if not exists mail_contact_idx on mail_messages(contact_id, sent_at desc);
create index if not exists mail_followup_idx on mail_messages(needs_followup, sent_at desc) where needs_followup = true;
create index if not exists notifications_user_due_idx on crm_notifications(user_id, due_at, read_at);
