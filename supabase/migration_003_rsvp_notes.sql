-- HubConnect migration 003 — notes on attendance changes + denormalized last note
-- Run this in the Supabase SQL editor (safe to re-run).

-- Note attached to each attendance/status change
alter table registration_rsvp_history
  add column if not exists note text;

-- Denormalized latest note on the registration (for fast Sales/Event listing)
alter table event_registrations
  add column if not exists last_note text;
alter table event_registrations
  add column if not exists last_activity_at timestamptz;

-- We now log attendance history explicitly from the server action (with the
-- note), so the auto-trigger is no longer needed and would double-log.
drop trigger if exists trg_rsvp_history on event_registrations;
