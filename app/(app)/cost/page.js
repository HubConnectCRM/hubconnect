import { requireProfile } from "@/lib/auth";
import CostSheetView from "@/components/CostSheetView";
import CostPickerView from "@/components/CostPickerView";

export default async function CostPage({ searchParams }) {
  const { event: eventId, leadFile: leadFileId } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const canManage = profile.role === "admin" || profile.role === "sales";

  // No scope picked yet — land here from the sidebar's own "Cost" tab, not
  // just from an event/lead file's own "Bilancino" button. List every event
  // and lead file so the sheet is reachable without going through one first.
  if (!eventId && !leadFileId) {
    const [{ data: events }, { data: leadFiles }, { data: scopedCosts }, { data: scopedRevenues }] = await Promise.all([
      supabase.from("events").select("id, name, start_date").order("start_date", { ascending: false }),
      supabase.from("lead_files").select("id, name, linked_event_id").order("name"),
      supabase.from("cost_items").select("event_id, lead_file_id"),
      supabase.from("revenue_items").select("event_id, lead_file_id"),
    ]);

    // A lead file linked to an event (lead_files.linked_event_id) is the
    // same real-world thing as that event — list it once, not once under
    // "Events" and again under "Leads". Whichever scope already has
    // cost/revenue rows keeps those rows visible; if neither does yet,
    // default to the event.
    const leadFileIdsWithData = new Set();
    for (const row of [...(scopedCosts || []), ...(scopedRevenues || [])]) {
      if (row.lead_file_id) leadFileIdsWithData.add(row.lead_file_id);
    }
    const linkedFileByEventId = new Map();
    const standaloneLeadFiles = [];
    for (const file of leadFiles || []) {
      if (file.linked_event_id) linkedFileByEventId.set(file.linked_event_id, file);
      else standaloneLeadFiles.push(file);
    }

    const scopes = (events || []).map((event) => {
      const linkedFile = linkedFileByEventId.get(event.id);
      const useLeadFile = linkedFile && leadFileIdsWithData.has(linkedFile.id);
      return {
        id: event.id,
        name: event.name,
        date: event.start_date,
        href: useLeadFile ? `/cost?leadFile=${linkedFile.id}` : `/cost?event=${event.id}`,
      };
    });
    for (const file of standaloneLeadFiles) {
      scopes.push({ id: file.id, name: file.name, date: null, href: `/cost?leadFile=${file.id}` });
    }

    return <CostPickerView scopes={scopes} />;
  }

  const [scopeResult, itemsResult, revenueItemsResult, dealsResult] = await Promise.all([
    eventId
      ? supabase.from("events").select("id, name").eq("id", eventId).single()
      : supabase.from("lead_files").select("id, name").eq("id", leadFileId).single(),
    supabase
      .from("cost_items")
      .select("id, description, imponibile, iva, paid, receipt_path, created_at, created_by:profiles(full_name, email)")
      .eq(eventId ? "event_id" : "lead_file_id", eventId || leadFileId)
      .order("created_at", { ascending: true }),
    supabase
      .from("revenue_items")
      .select("id, description, imponibile, iva, created_at, created_by:profiles(full_name, email)")
      .eq(eventId ? "event_id" : "lead_file_id", eventId || leadFileId)
      .order("created_at", { ascending: true }),
    eventId
      ? supabase
          .from("deals")
          .select("id, company_name, offer_value, iva, company:companies(name)")
          .eq("stage", "won")
          .or(`pushed_event_id.eq.${eventId},event_id.eq.${eventId}`)
      : supabase
          .from("deals")
          .select("id, company_name, offer_value, iva, company:companies(name)")
          .eq("stage", "won")
          .eq("lead_file_id", leadFileId),
  ]);

  const items = (itemsResult.data || []).map((item) => ({
    ...item,
    receiptUrl: item.receipt_path ? supabase.storage.from("cost-receipts").getPublicUrl(item.receipt_path).data.publicUrl : null,
  }));

  return (
    <CostSheetView
      scopeName={scopeResult.data?.name || ""}
      eventId={eventId || null}
      leadFileId={leadFileId || null}
      items={items}
      revenueItems={revenueItemsResult.data || []}
      deals={dealsResult.data || []}
      canManage={canManage}
    />
  );
}
