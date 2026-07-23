-- profiles.role (and chat_groups.position, which mirrors it for
-- "position"-kind chat groups) were left on the original 3-value user_role
-- enum when employee_invites.role was migrated to the 5-value app_role
-- enum elsewhere — so a freshly-registered employee whose invite carried
-- role 'events' (or 'accreditation'/'viewer') could never actually get a
-- profile row: handle_new_user()'s ::user_role cast rejected the value
-- outright, failing the entire auth.users insert with "Database error
-- creating new user". Migrating these two columns to app_role (remapping
-- the old singular 'event' -> 'events' for any existing rows) and updating
-- every function that referenced user_role to match is the actual fix.

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type public.app_role using (
  case role::text when 'event' then 'events' else role::text end
)::public.app_role;
alter table public.profiles alter column role set default 'sales'::public.app_role;

alter table public.chat_groups alter column position type public.app_role using (
  case position::text when 'event' then 'events' else position::text end
)::public.app_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = 'public' as $function$
begin
  insert into public.profiles(id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'sales'))
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.can_edit_events()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'events'), false)
$$;

create or replace function public.join_default_chat_groups()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); urole public.app_role;
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
