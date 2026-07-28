-- Permanently removes the duplicate "Beauty Connect 2026" pair confirmed
-- via migration_031/031b: "Beauty Connect 2026" (f296afcd-...) was
-- completely empty, and every one of the 296 people registered to
-- "Beauty Connect 2026 I chapter" (e73e04a6-...) exists ONLY because of
-- that event's registration (0 deals/lead_contacts/interactions/other
-- event regs) — so deleting them here does not touch any other real data.
--
-- Order matters: contacts are deleted first (cascades away their
-- event_registrations/interactions/call_logs for just these people),
-- then both event rows are deleted.

begin;

delete from public.contacts
where id in (
  select contact_id from public.event_registrations
  where event_id = 'e73e04a6-2fea-417d-a455-83a213bb08b7'
);

delete from public.events
where id in (
  'f296afcd-174c-4ddd-8198-1453e27d731a',
  'e73e04a6-2fea-417d-a455-83a213bb08b7'
);

commit;
