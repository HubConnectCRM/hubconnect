-- Timestamped speech "turns" for a call, one row per side's utterance, so a
-- call room's segments from BOTH participants (each only ever transcribes
-- their own voice locally — see CallTranscriptionManager.swift) can be
-- merged and re-ordered by real time into a single interleaved conversation
-- log, instead of two separate one-sided notes shown side by side.

create table if not exists public.call_transcript_segments (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.call_rooms(id) on delete cascade,
  speaker_id uuid references public.profiles(id) on delete set null default auth.uid(),
  text       text not null,
  spoken_at  timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists call_transcript_segments_room_spoken_idx on public.call_transcript_segments(room_id, spoken_at);

alter table public.call_transcript_segments enable row level security;

-- Mirrors call_notes' policy pair exactly: all authenticated employees share
-- the merged transcript, inactive accounts stay blocked everywhere.
drop policy if exists authenticated_all on public.call_transcript_segments;
create policy authenticated_all on public.call_transcript_segments
  as permissive for all to authenticated
  using (true)
  with check (true);

drop policy if exists active_employee_only on public.call_transcript_segments;
create policy active_employee_only on public.call_transcript_segments
  as restrictive for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

alter table public.call_transcript_segments replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_transcript_segments'
  ) then
    alter publication supabase_realtime add table public.call_transcript_segments;
  end if;
end $$;

notify pgrst, 'reload schema';
