# HubConnect V5 — Owner inference, Sales/Events separation, company cache backfill

## Fixed product logic

- Event imports no longer feed the Sales workspace. Sales now displays only won/closed opportunities from Leads (`stage = won`, `po_won = true`, or already pushed to an event).
- Leads remains the place for salespeople to manage companies/contacts they are speaking with.
- Event registrations remain inside Events.

## Smarter owner inference

- Import now resolves owner/responsible from the Excel row instead of blindly using the user who uploaded the file.
- Sales sheets like `NRF List.xlsx` with `Owner = Nir / Alberto`, `Alberto`, `Nir`, etc. are parsed from the owner column.
- Event sheets like Beauty Connect with values such as `si roberta`, `si emirhan`, `si francesco` are parsed as responsible people.
- For event sheets, if a block has `si roberta` and following rows only say `si`, the importer carries the last explicit responsible person down the block.
- If the person exists as a HubConnect profile, the contact/registration is assigned to that profile. If not, the textual owner is preserved in notes as `Responsible from Excel: ...` or `Owner from Excel: ...`.

## Company cache backfill

- Added a Companies page button: `Cache missing companies`.
- It scans old companies with missing website/overview and enriches them using no-AI web metadata scraping.
- It produces structured company cache fields: Company, What they do, Products/services, Target customers, Geography, Differentiators, Value proposition, Business model, Company size, Notable clients, Tone, Website.

## Safety

- No new required database column is used by runtime code, so the app does not break if Supabase migrations are not applied immediately.
- A migration file is included for future optional textual owner storage, but current code stores unmatched owner text in notes for compatibility.
