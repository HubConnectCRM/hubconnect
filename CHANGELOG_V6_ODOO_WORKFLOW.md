# HubConnect v6 — Odoo-style workflow fix

## Core workflow
- Events imports remain inside Events. They do not populate Sales.
- Leads is now the working area for salespeople: imported sales lead files, people, companies, and opportunity creation.
- Sales now shows only people/companies from Lead opportunities marked `won`, or opportunities pushed to events.

## Leads usability
- Lead file people rows are now editable directly.
- A user can edit person, company, role, email, phone, LinkedIn, owner, group, lead status, RSVP, source and notes.
- Each lead person row has:
  - `Opportunity` to create a sales opportunity from that person/company.
  - `Mark won` to create/update the opportunity as won and make it appear in Sales.
- This removes the need to use the old central Add Deal form for normal work.

## Company cache
- Company cache generation no longer repeats the same scraped sentence across every field.
- Weak/repetitive company caches are detected and can be regenerated.
- Companies list `Cache missing companies` now also targets weak/repetitive cache rows.
- Company detail has `Refresh cache` for a single company.
- Cache labels are kept structured and English by default; scraped public text remains in the original website language unless manually edited or AI translation is added later.

## Language/UI
- App header now uses translation keys for EN/IT/TR instead of hardcoded copy.
- Sales header uses EN/IT/TR translation keys.

## Build verification
- `next build` compiled successfully with dummy Supabase env values in the sandbox. The final command reached route generation/finalization; the shell timed out after completion output, but no compile/type errors appeared.
