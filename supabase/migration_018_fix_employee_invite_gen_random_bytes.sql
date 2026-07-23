-- create_employee_invite (migration_008) calls gen_random_bytes() with
-- search_path locked to just "public" — Supabase installs pgcrypto into the
-- "extensions" schema by default, not "public", so the function was never
-- actually visible and every invite-code creation failed with
-- "function gen_random_bytes(integer) does not exist". Schema-qualifying the
-- call removes the ambiguity regardless of search_path or which schema
-- pgcrypto ends up in.
create extension if not exists pgcrypto with schema extensions;

create or replace function create_employee_invite(p_email text default null, p_role user_role default 'sales', p_days integer default 14)
returns text language plpgsql security definer set search_path = public as $$
declare generated_code text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  generated_code := 'HUB-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  insert into employee_invites(code, email, role, created_by, expires_at)
  values (generated_code, nullif(lower(trim(p_email)), ''), p_role, auth.uid(), now() + make_interval(days => greatest(1, p_days)));
  return generated_code;
end $$;
grant execute on function create_employee_invite(text, user_role, integer) to authenticated;
