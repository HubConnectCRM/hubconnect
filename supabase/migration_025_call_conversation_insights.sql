-- Shared, cross-platform cache for a call's AI-generated summary/key
-- points/action items — one row per room. iOS generates this for free via
-- on-device Apple Intelligence; web (no such thing on Windows) reads
-- whatever's already here first, and only falls back to calling OpenAI with
-- the VIEWING user's own opted-in API key (profiles.openai_api_key_enc) if
-- nobody has generated one yet — so at most one participant ever needs a key
-- for everyone else to benefit.

create table if not exists public.call_conversation_insights (
  room_id             uuid primary key references public.call_rooms(id) on delete cascade,
  summary             text,
  key_points          jsonb not null default '[]'::jsonb,
  action_items        jsonb not null default '[]'::jsonb,
  generated_by        uuid references public.profiles(id) on delete set null,
  generated_platform  text not null default 'ios' check (generated_platform in ('ios', 'web')),
  created_at          timestamptz not null default now()
);

alter table public.call_conversation_insights enable row level security;

drop policy if exists authenticated_all on public.call_conversation_insights;
create policy authenticated_all on public.call_conversation_insights
  as permissive for all to authenticated
  using (true)
  with check (true);

drop policy if exists active_employee_only on public.call_conversation_insights;
create policy active_employee_only on public.call_conversation_insights
  as restrictive for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

-- Per-user, opt-in OpenAI key for the web conversation-insights fallback —
-- base64 "encryption" only, matching the existing mailbos_api_key_enc
-- pattern exactly (value never reaches the client, only decoded server-side
-- in a Server Action).
alter table public.profiles add column if not exists openai_api_key_enc text;

notify pgrst, 'reload schema';
