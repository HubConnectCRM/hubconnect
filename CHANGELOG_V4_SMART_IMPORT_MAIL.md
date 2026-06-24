# HubConnect V4 — Smart Import, Event Logic, Company Cache, Mail Center Foundation

## Fixed import stuck on Saving
- Import button now changes to `Saved ✓ Import again` after server action returns.
- Result text shows inserted / updated / linked / deals / event registrations / company caches.
- Server import was refactored from row-by-row inserts into batched company/contact/link operations.

## Faster imports
- Company creation is batched.
- Existing contact lookup is batched by normalized email.
- Lead/event links are upserted in chunks.
- Company cache enrichment is parallelized with short timeouts and capped to prevent long freezes.

## Beauty Connect event import logic
- Added mapping for:
  - blank first column values like `si emirhan`, `si roberta` → responsible/internal owner
  - `Risposta mail` → response_date
  - `Si/no` → RSVP/attendance signal
  - `Trattamento` → final decision
  - `Nome`, `Cognome`, `Job Title`, `Company`, `Mail`, `Telephone`, `Country`, `City`, `Note`
- Event registrations now use clearer semantics:
  - status = Registered / Waiting list / Confirmed / Declined
  - attendance = Yes / No / Maybe
  - setting Confirmed automatically sets attendance Yes
  - setting Declined automatically sets attendance No
- Event table no longer shows the purple `iscritti` group as if it were the final status; source sheet is visible in Details.

## Company cache
- Imported companies automatically get a structured non-AI company cache when a website/email domain can be derived.
- Cache format matches the MailBos-style structured profile:
  Company, What they do, Products/services, Target customers, Geography, Differentiators, Value proposition, Business model, Company size, Notable clients, Tone, Website.
- Company detail page renders this cache as a readable table.

## Mail Center / Notification Center foundation
- Added sidebar entries and pages for Mail Center and Notifications.
- Added migration_006_outlook_mail_center.sql with tables for:
  - outlook_accounts
  - mail_messages
  - crm_notifications
- Actual Outlook OAuth still requires Azure App Registration credentials and server routes.
