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
2. In the Supabase **SQL editor**, first run [`supabase/schema.sql`](supabase/schema.sql), then run the files in `supabase/migration_002_*.sql` through `supabase/migration_008_ios_web_parity.sql` in number order. Existing installations only need migrations they have not run yet; the iOS/Web parity work is in migration 008.
3. Copy `.env.example` to `.env.local` and fill in your project URL + anon key
   (Supabase → Settings → API).
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000, create the first account, then in Supabase set
   that profile's `role` to `admin` (table editor → `profiles`).

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
