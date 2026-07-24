-- Sales-sourced contacts pushed to an event via pushDealToEvent (a won,
-- paid deal) are always sponsors — the Events team handles guest/speaker
-- registrations themselves, separately. participant_type's CHECK
-- constraint only allowed guest/speaker/reserved_seat/staff; widening it
-- to include 'sponsor' so pushDealToEvent can tag these rows correctly
-- instead of silently falling through to the 'guest' default.
alter table public.event_registrations drop constraint if exists event_registrations_participant_type_check;
alter table public.event_registrations
  add constraint event_registrations_participant_type_check
  check (participant_type in ('guest', 'speaker', 'reserved_seat', 'staff', 'sponsor'));
