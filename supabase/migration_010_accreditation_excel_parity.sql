-- HubConnect migration 010 — accreditation spreadsheet parity
-- Keeps the two consent columns used by Retail Hub's accreditation workbooks.

alter table public.event_registrations
  add column if not exists hub_consent boolean not null default false;

alter table public.event_registrations
  add column if not exists partner_consent boolean not null default false;

update public.event_registrations
set hub_consent = coalesce(gdpr_consent, false)
where hub_consent = false and coalesce(gdpr_consent, false) = true;

create index if not exists event_reg_accreditation_type_idx
  on public.event_registrations(event_id, participant_type, badge_status, arrived);

alter table public.event_registrations replica identity full;
