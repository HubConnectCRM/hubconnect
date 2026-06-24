# HubConnect CRM v3 Real Fix

This ZIP contains the actual code changes for the issues reported on 2026-06-24.

## Import workflow

- Rebuilt `components/ImportWizard.js`.
- Added smart workbook classification:
  - Beauty / iscrizioni / Si-no / GDPR-style sheets are routed to **Event registrations**.
  - NRF List and FILE SALES-style workbooks are routed to **Sales pipeline + lead file**.
  - Generic sheets remain **Contacts only**.
- Destination is still manually overrideable before import.
- Added event import target:
  - existing event
  - or new event name
- Added sales import target:
  - existing lead file
  - new lead file
  - sales pipeline + lead file
- Added multi-sheet import:
  - can import all sheets
  - sheet names become groups/sub-groups
- Improved column mapping for the uploaded real files:
  - NRF List.xlsx
  - FILE SALES.xlsx
  - iscrizioni Beauty Connect 2026 - I chapter.xlsx
- Fixed bad `Company Name -> Full name` mapping by prioritizing company headers.
- Added support for owner, event, topic, last contact, last action, next step, RSVP and GDPR columns.

## Import backend

- Rebuilt `app/(app)/import/actions.js`.
- Sales import now creates/finds companies and contacts, links people to lead files, optionally creates one opportunity per company, and attaches people as deal reps.
- Event import now creates/finds contacts and companies, then creates/updates `event_registrations`.
- RSVP values are normalized from yes/no/maybe, si/no/forse, waiting list, confirmed, etc.
- Sheet names can create lead/event groups automatically.

## Sales / Leads UX

- Sales is now person/company-first instead of deal-form-first.
- Lead files are now person/company-first instead of deal-form-first.
- The old central Add Deal form is hidden behind `+ Create opportunity`.
- Added tabs/cards for People, Companies and Opportunities.
- Lead file detail now shows imported people directly, not only deals.

## New person / company cache

- `NewPersonModal` now lets the user type a new company directly while creating a person.
- Added optional website/domain field.
- Added non-AI company enrichment:
  - fetches the public homepage
  - scrapes title/meta description
  - stores the result in `companies.overview` and `companies.website`
- This uses no paid AI call.

## Dashboard

- Dashboard cards are now clickable.
- Added lead files and sales opportunities to dashboard cards.
- Added Import Excel shortcut.

## Build note

`next build` reached successful compile with dummy Supabase env. The sandbox still throws Next/Turbopack `EPIPE` while collecting page data, same as before, but the JavaScript/React compile phase succeeds.
