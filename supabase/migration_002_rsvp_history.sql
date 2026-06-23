-- HubConnect migration 002 — event RSVP (yes/no/maybe) + change history
-- Run this in the Supabase SQL editor (safe to re-run).

-- 1) RSVP answer on each registration
alter table event_registrations
  add column if not exists rsvp text check (rsvp in ('yes', 'no', 'maybe'));

-- 2) History of every rsvp / status change (who + when)
create table if not exists registration_rsvp_history (
  id              bigserial primary key,
  registration_id uuid not null references event_registrations(id) on delete cascade,
  rsvp            text,
  status          event_reg_status,
  changed_by      uuid references profiles(id),
  changed_at      timestamptz not null default now()
);
create index if not exists rsvp_hist_reg_idx
  on registration_rsvp_history (registration_id, changed_at desc);

alter table registration_rsvp_history enable row level security;

drop policy if exists rsvp_hist_select on registration_rsvp_history;
create policy rsvp_hist_select on registration_rsvp_history
  for select to authenticated using (true);

drop policy if exists rsvp_hist_insert on registration_rsvp_history;
create policy rsvp_hist_insert on registration_rsvp_history
  for insert to authenticated with check (true);

-- 3) Trigger: log the answer whenever rsvp (or status alongside it) changes
create or replace function log_rsvp_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if new.rsvp is not null then
      insert into registration_rsvp_history(registration_id, rsvp, status, changed_by)
      values (new.id, new.rsvp, new.status, auth.uid());
    end if;
  elsif (tg_op = 'UPDATE') then
    if new.rsvp is distinct from old.rsvp then
      insert into registration_rsvp_history(registration_id, rsvp, status, changed_by)
      values (new.id, new.rsvp, new.status, auth.uid());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_rsvp_history on event_registrations;
create trigger trg_rsvp_history
  after insert or update on event_registrations
  for each row execute function log_rsvp_change();
