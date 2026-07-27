-- Lets a lead's Estimated Value carry a VAT choice (no VAT, or +20%) so the
-- resulting deal — and therefore the Cost sheet's auto-synced RICAVI row —
-- shows the correct tax amount instead of always assuming a fixed rate.

alter table public.lead_contacts add column if not exists vat_rate integer not null default 20;
alter table public.lead_contacts drop constraint if exists lead_contacts_vat_rate_check;
alter table public.lead_contacts add constraint lead_contacts_vat_rate_check check (vat_rate in (0, 20));

alter table public.deals add column if not exists iva numeric(12,2) not null default 0;

notify pgrst, 'reload schema';
