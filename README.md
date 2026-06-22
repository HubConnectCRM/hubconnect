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
2. In the Supabase **SQL editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
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
through `event_registrations` (the desiderata / invite bridge). `deals` track the
pipeline. Every change to these tables is written to `audit_log` (who, when, what).

## Build phases

1. Foundation — auth, roles, trilingual shell, schema ✅
2. Companies + contacts CRUD
3. Interaction timeline + follow-ups
4. Events + the sales↔event bridge
5. Excel importer (migrate existing files)
6. Audit log UI, permissions polish, pipeline
