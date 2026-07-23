# HubConnect

Shared contact pool for sales & event teams — one place for the contacts sales
finds and the people the event team wants to reach, with full change history.

Replaces the scattered per-person Excel sheets (FILE SALES, Beauty Connect, NRF
List, …) with a single trilingual (EN / IT / TR) web app.

## Stack

- Next.js 16 (App Router) + React 19
- Supabase (PostgreSQL, Auth, Row Level Security)
- Tailwind CSS v4
- i18next (EN / IT / TR)
- exceljs (importing existing spreadsheets)

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL editor**, first run [`supabase/schema.sql`](supabase/schema.sql), then run the numbered files in `supabase/` in order. Existing installations only need migrations they have not run yet; migration 015 records shared call notes and migration 016 completes cross-device iOS/Web calling.
3. Copy `.env.example` to `.env.local` and fill in your project URL + anon key
   (Supabase → Settings → API).
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000, create the first account, then in Supabase set
   that profile's `role` to `admin` (table editor → `profiles`).

### Optional call-note summaries

Call transcripts are always saved to Supabase first. To add a best-effort
2–3 sentence Turkish summary, set `OPENAI_API_KEY` only in the server/Vercel
environment. The default model is `gpt-5-nano`; override it with
`OPENAI_CALL_SUMMARY_MODEL` if needed. If either the key or API is unavailable,
the raw transcript remains available and the call flow continues normally.

### iPhone ↔ web calls

Foreground calls use the same Supabase Realtime topics and WebRTC wire format
in Swift and the browser. The browser also polls the shared `call_invites`
table, so a temporarily missed socket broadcast is recovered automatically.

To ring an iPhone through CallKit while the iOS app is backgrounded or closed:

1. Run `supabase/migration_016_cross_device_calls.sql` on the shared project.
2. Deploy `supabase/functions/call-notify` with JWT verification disabled.
3. Set the function secrets `CALL_NOTIFY_SECRET`, `APNS_BUNDLE_ID`,
   `APNS_KEY_ID`, `APNS_TEAM_ID` and `APNS_AUTH_KEY`.
4. Create a Supabase Database Webhook for `public.call_invites` / `INSERT` that
   posts to the `call-notify` function and sends the same secret in the
   `x-webhook-secret` header.
5. Run `supabase/migration_017_call_delivery_reliability.sql` so each APNs
   token records the bundle identifier that issued it.

This webhook is shared by both clients: every invite inserted by either iOS or
web follows one delivery path, preventing two incompatible call systems.

Until step 3 is done the app shows a setup screen instead of crashing.

## Data model

`companies` ← `contacts` → `interactions` (timeline). Contacts link to `events`
through `event_registrations` (the invitation and live-accreditation bridge).
Lead files contain T90/T70/T50 follow-ups, can be approved and linked to events,
and won opportunities flow into Sales. Event-day arrival and badge changes are
synced live through Supabase Realtime. Every change is written to `audit_log`.

## Included workflows

- Internal login, password reset, company-code registration and admin account control
- User-focused dashboard, notifications and follow-ups
- Companies, contacts, call logging, sharing and MailBos mail centre
- Lead files, T90/T70/T50 prioritisation, reconnect reminders and owner filters
- Won-sales reporting by day/week/month/year and salesperson
- Event planning, guest confirmation, speaker/reserved-seat/badge fields
- Shared live accreditation desk for multiple event-day operators
- Excel import plus Sales, Leads and Accreditation workbooks
- English, Italian and Turkish interface
