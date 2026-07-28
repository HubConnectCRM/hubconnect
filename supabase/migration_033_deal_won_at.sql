-- Sales page date-period filtering (Daily/Weekly/Monthly/Yearly) falls back
-- to deals.updated_at when won_at is missing — but updated_at is bumped by
-- ANY edit to the deal (price sync, adding a rep, pushing to an event), so
-- a deal won weeks ago kept showing up under "today" every time it was
-- touched for an unrelated reason. This adds a real, stable won_at that is
-- only set at the moment a deal actually becomes won.

alter table public.deals add column if not exists won_at timestamptz;

-- Backfill: best-effort guess for deals that are already won. created_at is
-- a safer default than updated_at, since updated_at is the exact value
-- that was misleading everyone in the first place.
update public.deals
set won_at = created_at
where won_at is null
  and (stage = 'won' or po_won = true or pushed_event_id is not null);

notify pgrst, 'reload schema';
