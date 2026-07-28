-- Same check as migration_031, collapsed to one summary row so you don't
-- have to scroll through all 296. If "contacts_used_elsewhere" is 0, every
-- one of these 296 people exists ONLY because of this duplicate event and
-- is safe to delete entirely.

select
  count(*) as total_contacts,
  count(*) filter (
    where (select count(*) from deals d where d.contact_id = c.id) > 0
       or (select count(*) from lead_contacts lc where lc.contact_id = c.id) > 0
       or (select count(*) from interactions i where i.contact_id = c.id) > 0
       or (select count(*) from event_registrations er2 where er2.contact_id = c.id and er2.event_id <> 'e73e04a6-2fea-417d-a455-83a213bb08b7') > 0
  ) as contacts_used_elsewhere
from contacts c
join event_registrations er on er.contact_id = c.id
where er.event_id = 'e73e04a6-2fea-417d-a455-83a213bb08b7';
