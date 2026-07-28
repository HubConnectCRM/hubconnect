-- Diagnostic only, does not delete anything. Shows, among the 296 people
-- registered to the duplicate "Beauty Connect 2026 I chapter" event, how
-- many are ALSO used elsewhere in the system (deals, lead files, chat,
-- interactions) vs. only ever touched by this one event's registration.

select
  c.id as contact_id,
  c.first_name,
  c.last_name,
  (select count(*) from deals d where d.contact_id = c.id) as deals,
  (select count(*) from lead_contacts lc where lc.contact_id = c.id) as lead_contacts,
  (select count(*) from interactions i where i.contact_id = c.id) as interactions,
  (select count(*) from event_registrations er2 where er2.contact_id = c.id and er2.event_id <> 'e73e04a6-2fea-417d-a455-83a213bb08b7') as other_event_regs
from contacts c
join event_registrations er on er.contact_id = c.id
where er.event_id = 'e73e04a6-2fea-417d-a455-83a213bb08b7';
