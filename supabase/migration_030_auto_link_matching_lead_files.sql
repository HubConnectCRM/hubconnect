-- Auto-links a lead file to the event of the same name when no explicit
-- link exists yet (lead_files.linked_event_id). This is what makes the
-- Cost picker show ONE card instead of two for the same real-world file —
-- no rows are deleted, no contacts/companies/deals/cost items touched.

update public.lead_files lf
set linked_event_id = e.id
from public.events e
where lf.linked_event_id is null
  and lower(trim(lf.name)) = lower(trim(e.name));

notify pgrst, 'reload schema';
