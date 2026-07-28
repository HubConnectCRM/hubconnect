-- Italy's actual standard VAT (IVA) rate is 22%, not 20% — corrects the
-- earlier default/option before it gets used more widely across real leads.

alter table public.lead_contacts drop constraint if exists lead_contacts_vat_rate_check;
update public.lead_contacts set vat_rate = 22 where vat_rate = 20;
alter table public.lead_contacts alter column vat_rate set default 22;
alter table public.lead_contacts add constraint lead_contacts_vat_rate_check check (vat_rate in (0, 22));

-- Recompute deals.iva for any deal whose price/VAT came from a lead that
-- just got corrected above (same join used by migration_029's backfill).
update public.deals d
set iva = lc.estimated_value * (lc.vat_rate::numeric / 100)
from public.lead_contacts lc
join public.deal_reps dr on dr.contact_id = lc.contact_id
where dr.deal_id = d.id
  and d.lead_file_id = lc.lead_file_id
  and lc.estimated_value > 0;

notify pgrst, 'reload schema';
