-- Reliable iOS call delivery.
-- Safe to run repeatedly.

-- APNs topics must exactly match the bundle that produced each token. Keeping
-- it with the token prevents a stale global secret from silently breaking
-- calls after a bundle identifier change.
alter table public.push_tokens
  add column if not exists bundle_id text;

comment on column public.push_tokens.bundle_id is
  'Bundle identifier that issued this APNs or PushKit token.';
