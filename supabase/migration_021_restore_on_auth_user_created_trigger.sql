-- Discovered via pg_trigger inspection after the previous fix: the ONLY
-- AFTER INSERT ON auth.users trigger left after dropping the broken
-- create_employee_profile_after_signup was validate_employee_invite_before_signup
-- (a BEFORE trigger — it only validates/injects role metadata, it never
-- creates a profiles row). on_auth_user_created (which calls the already-
-- correct handle_new_user()) did not exist at all — it must have been
-- dropped out-of-band at some point before this session even started,
-- with create_employee_profile_after_signup apparently meant to replace
-- it but never finished (stuck on the old user_role cast). Net effect:
-- deleting that broken duplicate left NO trigger creating profiles rows at
-- all — new signups succeed in auth.users but never get a profiles row
-- (confirmed: "already registered" on re-signup, zero rows in
-- public.profiles for that email). Restoring the original trigger,
-- pointing at the already-fixed handle_new_user().
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any auth.users row created during the window this trigger was
-- missing needs its profiles row created manually, using the SAME
-- coalesce-to-role-metadata logic handle_new_user() would have run.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  coalesce((u.raw_user_meta_data->>'role')::public.app_role, 'sales')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
