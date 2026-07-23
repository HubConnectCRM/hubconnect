-- create_employee_invite (migration_008) calls gen_random_bytes() with
-- search_path locked to just "public" — Supabase installs pgcrypto into the
-- "extensions" schema by default, not "public", so the function was never
-- actually visible and every invite-code creation failed with
-- "function gen_random_bytes(integer) does not exist". Schema-qualifying the
-- call removes the ambiguity regardless of search_path or which schema
-- pgcrypto ends up in.
--
-- Separately, employee_invites.role was migrated out-of-band (not in any
-- file in this repo) from the original 3-value user_role enum to a 5-value
-- app_role enum (admin/sales/events/accreditation/viewer, matching the
-- RBAC roles used elsewhere) — but this function's parameter was never
-- updated to match, so every insert failed with "column "role" is of type
-- app_role but expression is of type user_role". Old callers passing
-- 'event' (singular, the old enum's value) must now pass 'events'.
--
-- A THIRD, separate issue found after fixing the above two: the
-- employee-register Edge Function (deployed directly to Supabase, not
-- versioned in this repo) was rewritten at some point to look up invites by
-- a SHA-256 code_hash column instead of the plaintext code column — plain
-- code is still generated/returned/shown to the admin (so it can still be
-- shared with the new employee), but this function never computed or
-- stored code_hash at all, so the Edge Function's lookup always found zero
-- rows and rejected every code as "invalid or expired" regardless of
-- whether it was ever actually redeemed. convert_to(..., 'UTF8') matches
-- the Edge Function's `new TextEncoder().encode(...)` byte-for-byte.
create extension if not exists pgcrypto with schema extensions;

drop function if exists create_employee_invite(text, user_role, integer);

create or replace function create_employee_invite(p_email text default null, p_role app_role default 'sales', p_days integer default 14)
returns text language plpgsql security definer set search_path = public as $$
declare generated_code text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  generated_code := 'HUB-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  insert into employee_invites(code, code_hash, email, role, created_by, expires_at)
  values (
    generated_code,
    encode(extensions.digest(convert_to(upper(generated_code), 'UTF8'), 'sha256'), 'hex'),
    nullif(lower(trim(p_email)), ''),
    p_role,
    auth.uid(),
    now() + make_interval(days => greatest(1, p_days))
  );
  return generated_code;
end $$;
grant execute on function create_employee_invite(text, app_role, integer) to authenticated;
