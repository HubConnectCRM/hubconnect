-- One-time backfill: deals created before the VAT/price-sync fix (see
-- app/(app)/leads/actions.js updateLeadPerson) are stuck with whatever
-- offer_value/iva they had at the moment they were converted/won, even
-- though the lead's own price may have changed since. This copies the
-- lead's current estimated_value/vat_rate onto any deal still linked to it.

update public.deals d
set offer_value = lc.estimated_value,
    iva = lc.estimated_value * (lc.vat_rate::numeric / 100)
from public.lead_contacts lc
join public.deal_reps dr on dr.contact_id = lc.contact_id
where dr.deal_id = d.id
  and d.lead_file_id = lc.lead_file_id
  and lc.estimated_value > 0;

notify pgrst, 'reload schema';
