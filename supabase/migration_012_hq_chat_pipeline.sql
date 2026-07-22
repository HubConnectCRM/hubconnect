-- Web/iOS parity for HQ Chat and the T90 lead pipeline.
-- Idempotent: safe to run when the iOS setup has already created these objects.

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(), name text not null,
  kind text not null default 'custom' check (kind in ('company','event','position','custom')),
  event_id uuid references public.events(id) on delete cascade,
  position public.user_role, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), avatar_url text
);
create unique index if not exists chat_groups_company_singleton on public.chat_groups ((kind)) where kind = 'company';
create unique index if not exists chat_groups_position_singleton on public.chat_groups (position) where kind = 'position';
create unique index if not exists chat_groups_event_singleton on public.chat_groups (event_id) where kind = 'event';

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_admin boolean not null default false, joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.chat_group_members add column if not exists is_admin boolean not null default false;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), body text not null default '',
  created_at timestamptz not null default now(), edited_at timestamptz,
  delivered_at timestamptz, image_url text
);
alter table public.chat_groups add column if not exists avatar_url text;
alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists delivered_at timestamptz;
alter table public.chat_messages add column if not exists image_url text;
create index if not exists chat_messages_group_idx on public.chat_messages (group_id, created_at);

create table if not exists public.chat_read_state (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(), primary key (group_id, user_id)
);

create or replace function public.can_access_chat_group(gid uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $$
  select exists(select 1 from public.chat_group_members m where m.group_id = gid and m.user_id = auth.uid());
$$;
create or replace function public.is_chat_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $$
  select exists(select 1 from public.chat_group_members m where m.group_id = gid and m.user_id = auth.uid() and m.is_admin);
$$;
create or replace function public.join_default_chat_groups()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); urole public.user_role;
begin
  select role into urole from public.profiles where id = uid;
  insert into public.chat_group_members (group_id, user_id)
  select id, uid from public.chat_groups where kind in ('company','event')
  on conflict (group_id, user_id) do nothing;
  if urole is not null and urole <> 'viewer' then
    insert into public.chat_group_members (group_id, user_id)
    select id, uid from public.chat_groups where kind = 'position' and position = urole
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;
grant execute on function public.join_default_chat_groups() to authenticated;

create or replace function public.create_chat_group(p_name text, p_member_ids uuid[] default '{}'::uuid[])
returns uuid language plpgsql security definer set search_path = public set row_security = off as $$
declare uid uuid := auth.uid(); gid uuid := gen_random_uuid(); clean_name text := nullif(btrim(p_name), '');
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and is_active = true) then raise exception 'active_user_required'; end if;
  if clean_name is null then raise exception 'name_required'; end if;
  insert into public.chat_groups (id, name, kind, created_by) values (gid, clean_name, 'custom', uid);
  insert into public.chat_group_members (group_id, user_id, is_admin) values (gid, uid, true);
  insert into public.chat_group_members (group_id, user_id, is_admin)
  select gid, p.id, false from public.profiles p
  where p.is_active = true and p.id <> uid and p.id = any(coalesce(p_member_ids, '{}'::uuid[]))
  on conflict (group_id, user_id) do nothing;
  if not exists (select 1 from public.chat_group_members where group_id = gid and user_id <> uid) then raise exception 'member_required'; end if;
  return gid;
end;
$$;
revoke all on function public.create_chat_group(text, uuid[]) from public;
grant execute on function public.create_chat_group(text, uuid[]) to authenticated;

insert into public.chat_group_members (group_id, user_id, is_admin)
select g.id, p.id, (g.created_by = p.id)
from public.chat_groups g
join public.profiles p on (g.kind in ('company','event') or (g.kind = 'position' and p.role = g.position))
where p.is_active
on conflict (group_id, user_id) do nothing;
update public.chat_group_members m set is_admin = true
from public.chat_groups g
where g.id = m.group_id and g.kind = 'custom' and g.created_by = m.user_id and not m.is_admin;

alter table public.chat_groups enable row level security;
drop policy if exists chat_groups_select on public.chat_groups;
create policy chat_groups_select on public.chat_groups for select to authenticated using (public.can_access_chat_group(id));
drop policy if exists chat_groups_insert on public.chat_groups;
create policy chat_groups_insert on public.chat_groups for insert to authenticated with check (public.is_active_user());
drop policy if exists chat_groups_update on public.chat_groups;
create policy chat_groups_update on public.chat_groups for update to authenticated using ((kind = 'custom' and public.is_chat_group_admin(id)) or (kind <> 'custom' and public.is_admin())) with check ((kind = 'custom' and public.is_chat_group_admin(id)) or (kind <> 'custom' and public.is_admin()));

alter table public.chat_group_members enable row level security;
drop policy if exists chat_group_members_select on public.chat_group_members;
create policy chat_group_members_select on public.chat_group_members for select to authenticated using (user_id = auth.uid() or public.can_access_chat_group(group_id));
drop policy if exists chat_group_members_insert on public.chat_group_members;
create policy chat_group_members_insert on public.chat_group_members for insert to authenticated with check (public.is_active_user());
drop policy if exists chat_group_members_delete on public.chat_group_members;
create policy chat_group_members_delete on public.chat_group_members for delete to authenticated using (user_id = auth.uid() or public.can_access_chat_group(group_id));
drop policy if exists chat_group_members_update on public.chat_group_members;
create policy chat_group_members_update on public.chat_group_members for update to authenticated using (public.is_chat_group_admin(group_id)) with check (public.is_chat_group_admin(group_id));

alter table public.chat_messages enable row level security;
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select to authenticated using (public.can_access_chat_group(group_id));
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (public.can_access_chat_group(group_id) and sender_id = auth.uid());
drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages for delete to authenticated using (sender_id = auth.uid());

alter table public.chat_read_state enable row level security;
drop policy if exists chat_read_state_owner on public.chat_read_state;
create policy chat_read_state_owner on public.chat_read_state for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists chat_read_state_select_fellow_members on public.chat_read_state;
create policy chat_read_state_select_fellow_members on public.chat_read_state for select to authenticated using (public.can_access_chat_group(group_id));

insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', true) on conflict (id) do nothing;
drop policy if exists chat_images_read on storage.objects;
create policy chat_images_read on storage.objects for select to authenticated using (bucket_id = 'chat-images');
drop policy if exists chat_images_insert on storage.objects;
create policy chat_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'chat-images' and public.is_active_user());

alter table public.lead_contacts add column if not exists pipeline_stage int not null default 0 check (pipeline_stage between 0 and 6);
create table if not exists public.lead_pipeline_events (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.lead_contacts(id) on delete cascade,
  stage int not null check (stage between 0 and 6), changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.lead_pipeline_events enable row level security;
drop policy if exists active_employee_only on public.lead_pipeline_events;
create policy active_employee_only on public.lead_pipeline_events as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user());

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
