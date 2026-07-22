-- In-app video/audio calling (Supabase Realtime broadcast + presence for
-- signaling; WebRTC mesh, STUN-only, no third-party video vendor). See the
-- HubConnect iOS repo for the matching client-side protocol.

create table if not exists call_rooms (
  id         uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  kind       text not null default 'video' check (kind in ('audio','video')),
  status     text not null default 'ringing' check (status in ('ringing','active','ended')),
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);
alter table call_rooms enable row level security;
drop policy if exists active_employee_only on call_rooms;
create policy active_employee_only on call_rooms as restrictive for all to authenticated
  using (is_active_user()) with check (is_active_user());

-- Authoritative "who's in the room since when" — joined_at (server clock) is
-- the arbiter for the mesh negotiation's elder/offerer rule.
create table if not exists call_room_participants (
  room_id   uuid not null references call_rooms(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (room_id, user_id)
);
alter table call_room_participants enable row level security;
drop policy if exists active_employee_only on call_room_participants;
create policy active_employee_only on call_room_participants as restrictive for all to authenticated
  using (is_active_user()) with check (is_active_user());

-- One row per (room, invited callee) — audit trail of ring/accept/decline.
create table if not exists call_invites (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references call_rooms(id) on delete cascade,
  caller_id    uuid references profiles(id) on delete set null,
  callee_id    uuid not null references profiles(id) on delete cascade,
  status       text not null default 'ringing' check (status in ('ringing','accepted','declined','cancelled','timed_out')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (room_id, callee_id)
);
alter table call_invites enable row level security;
drop policy if exists active_employee_only on call_invites;
create policy active_employee_only on call_invites as restrictive for all to authenticated
  using (is_active_user()) with check (is_active_user());
