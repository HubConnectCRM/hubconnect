-- HubConnect migration 011 — separate event confirmation from event-day attendance
-- and enforce Sales / Events / Accreditation ownership at database level.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active = true)
$$;

create or replace function public.can_edit_sales()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'sales'), false)
$$;

create or replace function public.can_edit_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'event'), false)
$$;

alter table public.event_registrations
  add column if not exists attendance_status text not null default 'pending';
alter table public.event_registrations
  drop constraint if exists event_registrations_attendance_status_check;
alter table public.event_registrations
  add constraint event_registrations_attendance_status_check
  check (attendance_status in ('pending', 'attended', 'not_attended'));
alter table public.event_registrations
  add column if not exists event_day_note text;
alter table public.event_registrations
  add column if not exists attendance_recorded_by uuid references public.profiles(id) on delete set null;
alter table public.event_registrations
  add column if not exists attendance_recorded_at timestamptz;

-- Preserve historical check-ins while turning status/rsvp back into the Events team's decision.
update public.event_registrations
set attendance_status = case
  when arrived = true or status = 'attended' then 'attended'
  when status = 'no_show' then 'not_attended'
  else 'pending'
end
where attendance_status = 'pending';

update public.event_registrations
set status = 'confirmed', rsvp = 'yes'
where status in ('attended', 'no_show');

create table if not exists public.event_accreditation_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_starts_on date not null,
  access_ends_on date not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_accreditation_assignment_dates check (access_ends_on >= access_starts_on),
  unique(event_id, user_id)
);

create index if not exists event_accreditation_assignments_user_idx
  on public.event_accreditation_assignments(user_id, active, access_starts_on, access_ends_on);
create index if not exists event_reg_attendance_idx
  on public.event_registrations(event_id, attendance_status, rsvp);

drop trigger if exists trg_event_accreditation_assignments_updated on public.event_accreditation_assignments;
create trigger trg_event_accreditation_assignments_updated
before update on public.event_accreditation_assignments
for each row execute function public.set_updated_at();

create or replace function public.is_accreditation_assigned(p_event_id uuid, p_on_date date default current_date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.event_accreditation_assignments a
    join public.profiles p on p.id = a.user_id and p.is_active = true
    where a.event_id = p_event_id
      and a.user_id = auth.uid()
      and a.active = true
      and p_on_date between a.access_starts_on and a.access_ends_on
  )
$$;

create or replace function public.sync_event_day_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.arrived then new.attendance_status := 'attended'; end if;
  elsif new.arrived is distinct from old.arrived
    and new.attendance_status is not distinct from old.attendance_status then
    new.attendance_status := case when new.arrived then 'attended' else 'pending' end;
  end if;

  new.arrived := new.attendance_status = 'attended';
  return new;
end $$;

drop trigger if exists trg_sync_event_day_attendance on public.event_registrations;
create trigger trg_sync_event_day_attendance
before insert or update on public.event_registrations
for each row execute function public.sync_event_day_attendance();

-- Accreditation writes go through this narrow RPC. It can change event-day fields only.
create or replace function public.update_accreditation_registrations(
  p_registration_ids uuid[],
  p_patch jsonb
)
returns setof public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event_count integer;
  v_row_count integer;
  v_attendance text;
  v_allowed_keys text[] := array[
    'attendance_status', 'badge_status', 'participant_type',
    'event_day_note', 'hub_consent', 'partner_consent'
  ];
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'not_authenticated';
  end if;
  if p_registration_ids is null or cardinality(p_registration_ids) = 0 then
    raise exception 'no_registrations';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) as key(value) where not (value = any(v_allowed_keys))) then
    raise exception 'invalid_accreditation_field';
  end if;

  select event_id into v_event_id
  from public.event_registrations
  where id = any(p_registration_ids)
  limit 1;

  select count(distinct event_id), count(*)
  into v_event_count, v_row_count
  from public.event_registrations
  where id = any(p_registration_ids);

  if v_event_id is null or v_event_count <> 1 then raise exception 'invalid_event_scope'; end if;
  if v_row_count <> cardinality(p_registration_ids) then
    raise exception 'registration_not_found';
  end if;

  if not public.is_admin() and not public.is_accreditation_assigned(v_event_id, current_date) then
    raise exception 'accreditation_access_denied';
  end if;

  if p_patch ? 'attendance_status' then
    v_attendance := p_patch->>'attendance_status';
    if v_attendance not in ('pending', 'attended', 'not_attended') then
      raise exception 'invalid_attendance_status';
    end if;
  end if;

  return query
  update public.event_registrations r
  set
    attendance_status = case when p_patch ? 'attendance_status' then p_patch->>'attendance_status' else r.attendance_status end,
    badge_status = case when p_patch ? 'badge_status' then p_patch->>'badge_status' else r.badge_status end,
    participant_type = case when p_patch ? 'participant_type' then p_patch->>'participant_type' else r.participant_type end,
    event_day_note = case when p_patch ? 'event_day_note' then nullif(p_patch->>'event_day_note', '') else r.event_day_note end,
    hub_consent = case when p_patch ? 'hub_consent' then (p_patch->>'hub_consent')::boolean else r.hub_consent end,
    partner_consent = case when p_patch ? 'partner_consent' then (p_patch->>'partner_consent')::boolean else r.partner_consent end,
    checked_in_by = case
      when p_patch ? 'attendance_status' and v_attendance = 'attended' then auth.uid()
      when p_patch ? 'attendance_status' then null
      else r.checked_in_by
    end,
    checked_in_at = case
      when p_patch ? 'attendance_status' and v_attendance = 'attended' then now()
      when p_patch ? 'attendance_status' then null
      else r.checked_in_at
    end,
    attendance_recorded_by = case when p_patch ? 'attendance_status' then auth.uid() else r.attendance_recorded_by end,
    attendance_recorded_at = case when p_patch ? 'attendance_status' then now() else r.attendance_recorded_at end
  where r.id = any(p_registration_ids)
  returning r.*;
end $$;

grant execute on function public.update_accreditation_registrations(uuid[], jsonb) to authenticated;

-- Assignment table permissions.
alter table public.event_accreditation_assignments enable row level security;
drop policy if exists event_accreditation_assignments_select on public.event_accreditation_assignments;
create policy event_accreditation_assignments_select on public.event_accreditation_assignments
for select to authenticated using (public.is_active_user());
drop policy if exists event_accreditation_assignments_insert on public.event_accreditation_assignments;
create policy event_accreditation_assignments_insert on public.event_accreditation_assignments
for insert to authenticated with check (public.can_edit_events() and assigned_by = auth.uid());
drop policy if exists event_accreditation_assignments_update on public.event_accreditation_assignments;
create policy event_accreditation_assignments_update on public.event_accreditation_assignments
for update to authenticated using (public.can_edit_events()) with check (public.can_edit_events());
drop policy if exists event_accreditation_assignments_delete on public.event_accreditation_assignments;
create policy event_accreditation_assignments_delete on public.event_accreditation_assignments
for delete to authenticated using (public.can_edit_events());

-- Events: everybody active can read; Events/Admin own edits. Sales may create a shell
-- event from a won lead, but cannot later edit Event-team data.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (public.is_active_user());
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (public.is_active_user() and created_by = auth.uid());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated using (public.can_edit_events()) with check (public.can_edit_events());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (public.can_edit_events());

-- Event registrations: Sales can nominate a person; Events/Admin decide attendance intent.
-- Event-day attendance itself is only writable through the assignment-checked RPC above.
drop policy if exists event_registrations_select on public.event_registrations;
create policy event_registrations_select on public.event_registrations for select to authenticated using (public.is_active_user());
drop policy if exists event_registrations_insert on public.event_registrations;
create policy event_registrations_insert on public.event_registrations for insert to authenticated
with check (
  public.can_edit_events()
  or (public.can_edit_sales() and registration_source = 'sales')
);
drop policy if exists event_registrations_update on public.event_registrations;
create policy event_registrations_update on public.event_registrations for update to authenticated
using (public.can_edit_events()) with check (public.can_edit_events());
drop policy if exists event_registrations_delete on public.event_registrations;
create policy event_registrations_delete on public.event_registrations for delete to authenticated using (public.can_edit_events());

-- Sales workspaces are visible to Events, but editable by Sales/Admin only.
do $$
declare t text;
begin
  foreach t in array array['lead_files', 'lead_contacts', 'deals', 'deal_reps'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_role', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_sales())', t || '_insert_role', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_sales()) with check (public.can_edit_sales())', t || '_update_role', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_sales())', t || '_delete_role', t);
  end loop;
end $$;

-- Remove the original permissive policies whose names differ from the base schema.
drop policy if exists "auth insert lead_files" on public.lead_files;
drop policy if exists "auth update lead_files" on public.lead_files;
drop policy if exists "auth delete lead_files" on public.lead_files;
drop policy if exists "auth insert lead_contacts" on public.lead_contacts;
drop policy if exists "auth update lead_contacts" on public.lead_contacts;
drop policy if exists "auth delete lead_contacts" on public.lead_contacts;
drop policy if exists deals_insert on public.deals;
drop policy if exists deals_update on public.deals;
drop policy if exists deals_delete on public.deals;
drop policy if exists deal_reps_insert on public.deal_reps;
drop policy if exists deal_reps_update on public.deal_reps;
drop policy if exists deal_reps_delete on public.deal_reps;

-- Group ownership follows the workspace it belongs to.
drop policy if exists "auth insert contact_groups" on public.contact_groups;
drop policy if exists "auth update contact_groups" on public.contact_groups;
drop policy if exists "auth delete contact_groups" on public.contact_groups;
drop policy if exists contact_groups_insert_role on public.contact_groups;
create policy contact_groups_insert_role on public.contact_groups for insert to authenticated with check (
  (lead_file_id is not null and public.can_edit_sales())
  or (event_id is not null and public.can_edit_events())
);
drop policy if exists contact_groups_update_role on public.contact_groups;
create policy contact_groups_update_role on public.contact_groups for update to authenticated using (
  (lead_file_id is not null and public.can_edit_sales())
  or (event_id is not null and public.can_edit_events())
) with check (
  (lead_file_id is not null and public.can_edit_sales())
  or (event_id is not null and public.can_edit_events())
);
drop policy if exists contact_groups_delete_role on public.contact_groups;
create policy contact_groups_delete_role on public.contact_groups for delete to authenticated using (
  (lead_file_id is not null and public.can_edit_sales())
  or (event_id is not null and public.can_edit_events())
);

alter table public.event_accreditation_assignments replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_accreditation_assignments'
  ) then
    alter publication supabase_realtime add table public.event_accreditation_assignments;
  end if;
end $$;
