-- Migration 007: preserve textual responsible owner from messy Excel imports
-- Useful when the Excel owner is "Roberta" / "Nir / Alberto" but that person is not yet a HubConnect user profile.
alter table event_registrations
  add column if not exists requested_by_text text;

create index if not exists event_reg_requested_by_text_idx on event_registrations (requested_by_text);
