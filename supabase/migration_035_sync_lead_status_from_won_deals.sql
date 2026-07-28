-- Changing a deal's stage from the Sales page (dropdown, or "push to event")
-- never wrote back to the lead_contacts row it came from — Performance and
-- the Leads page's own "Won" badge read lead_contacts.status directly, so a
-- deal marked won there kept showing as still-open/T90 on the Leads side.
-- Code fixed going forward (app/(app)/deals/actions.js); this is the
-- one-time backfill for deals that were already won before that fix.

update public.lead_contacts lc
set status = 'won'
from public.deal_reps dr
join public.deals d on d.id = dr.deal_id
where dr.contact_id = lc.contact_id
  and d.lead_file_id = lc.lead_file_id
  and (d.stage = 'won' or d.po_won = true)
  and lc.status <> 'won';

notify pgrst, 'reload schema';
