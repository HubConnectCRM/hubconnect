"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { saveCallOutcome } from "@/app/(app)/calls/actions";

const COPY = {
  en: { people: "People", companies: "Companies", recent: "Recent", contacts: "contacts", openCompany: "Open company", openProfile: "Open profile", email: "Email", details: "Contact details", noCompanies: "No companies found." },
  tr: { people: "Kişiler", companies: "Şirketler", recent: "Son hareketler", contacts: "kişi", openCompany: "Şirketi aç", openProfile: "Profili aç", email: "Mail", details: "İletişim bilgileri", noCompanies: "Şirket bulunamadı." },
  it: { people: "Persone", companies: "Aziende", recent: "Recenti", contacts: "contatti", openCompany: "Apri azienda", openProfile: "Apri profilo", email: "Email", details: "Dettagli contatto", noCompanies: "Nessuna azienda trovata." },
};

export default function CallCenterView({ contacts, companies = [], logs, related }) {
  const { t, i18n } = useTranslation();
  const c = COPY[i18n.language?.slice(0, 2)] || COPY.en;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("people");
  const [openCompany, setOpenCompany] = useState(null);
  const term = query.trim().toLowerCase();

  const filtered = useMemo(() => contacts.filter((contact) => !term || [contact.full_name, contact.email, contact.phone, contact.job_title, contact.company?.name].filter(Boolean).join(" ").toLowerCase().includes(term)).slice(0, 200), [contacts, term]);
  const filteredCompanies = useMemo(() => companies.filter((company) => !term || [company.name, company.sector, company.country, company.city, company.website, ...(company.contacts || []).map((person) => person.full_name)].filter(Boolean).join(" ").toLowerCase().includes(term)).slice(0, 150), [companies, term]);

  useEffect(() => {
    const key = "hubconnect.pendingCall";
    function markLeft() {
      try {
        const pending = JSON.parse(sessionStorage.getItem(key) || "null");
        if (pending) sessionStorage.setItem(key, JSON.stringify({ ...pending, leftAt: pending.leftAt || Date.now() }));
      } catch { /* Ignore an invalid local record. */ }
    }
    function showOutcomeWhenBack() {
      try {
        const pending = JSON.parse(sessionStorage.getItem(key) || "null");
        if (!pending) return;
        const elapsed = Date.now() - Number(pending.startedAt || 0);
        if (elapsed > 3 * 60 * 60 * 1000) { sessionStorage.removeItem(key); return; }
        if (elapsed < 3000 || !pending.leftAt) return;
        const contact = contacts.find((item) => item.id === pending.contactId);
        if (contact) setSelected({ contact, type: pending.type || "Telefon" });
        sessionStorage.removeItem(key);
      } catch { sessionStorage.removeItem(key); }
    }
    function visibilityChanged() { if (document.hidden) markLeft(); else showOutcomeWhenBack(); }
    window.addEventListener("blur", markLeft);
    window.addEventListener("focus", showOutcomeWhenBack);
    document.addEventListener("visibilitychange", visibilityChanged);
    showOutcomeWhenBack();
    return () => { window.removeEventListener("blur", markLeft); window.removeEventListener("focus", showOutcomeWhenBack); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [contacts]);

  function startTrackedCall(contact, type) {
    const links = {
      Telefon: contact.phone ? `tel:${contact.phone}` : null,
      "Google Meet": "https://meet.google.com/new",
      Zoom: "https://zoom.us/start/videomeeting",
      Teams: "https://teams.microsoft.com/l/meeting/new",
    };
    sessionStorage.setItem("hubconnect.pendingCall", JSON.stringify({ contactId: contact.id, type, startedAt: Date.now(), leftAt: null }));
    if (links[type]) window.open(links[type], type === "Telefon" ? "_self" : "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("contactCenter.callTitle")} subtitle={t("contactCenter.callDescription")} />

      <Card className="mb-4 p-2">
        <div className="grid grid-cols-3 gap-1">
          {[["people", c.people, contacts.length], ["companies", c.companies, companies.length], ["recent", c.recent, logs.length]].map(([value, label, count]) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${tab === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-white/5"}`}>{label} · {count}</button>
          ))}
        </div>
      </Card>

      {tab !== "recent" && <Card className="mb-4 p-4"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("contactCenter.searchContacts")} autoFocus /></Card>}

      {tab === "people" && (filtered.length === 0 ? <EmptyState>{t("contacts.empty")}</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact) => (
            <Card key={contact.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-semibold">{contact.full_name}</p><p className="truncate text-sm text-[var(--muted)]">{contact.job_title || "—"} · {contact.company?.name || "—"}</p></div>
                <Badge color={related[contact.id]?.length ? "brand" : "gray"}>{related[contact.id]?.length || 0}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-400"><p>{contact.phone || t("contactCenter.noPhone")}</p><p className="truncate">{contact.email || "—"}</p>{contact.source && <p>{contact.source}</p>}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {contact.phone && <Button type="button" onClick={() => startTrackedCall(contact, "Telefon")}>{t("contactCenter.startCall")}</Button>}
                <Button type="button" variant="secondary" onClick={() => startTrackedCall(contact, "Google Meet")}>Meet</Button>
                <Button type="button" variant="secondary" onClick={() => startTrackedCall(contact, "Zoom")}>Zoom</Button>
                <Button type="button" variant="secondary" onClick={() => startTrackedCall(contact, "Teams")}>Teams</Button>
                {contact.email && <Button href={`/mail?to=${encodeURIComponent(contact.email)}`} variant="secondary">{c.email}</Button>}
                <Button type="button" variant="secondary" onClick={() => setSelected({ contact, type: "Telefon" })}>{t("contactCenter.logResult")}</Button>
                <Button href={`/contacts/${contact.id}`} variant="secondary">{c.openProfile}</Button>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === "companies" && (filteredCompanies.length === 0 ? <EmptyState>{c.noCompanies}</EmptyState> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredCompanies.map((company) => {
            const expanded = openCompany === company.id;
            return <Card key={company.id} className="overflow-hidden">
              <button type="button" onClick={() => setOpenCompany(expanded ? null : company.id)} className="flex w-full items-start justify-between gap-4 p-5 text-left">
                <div><p className="font-semibold">{company.name}</p><p className="mt-1 text-sm text-[var(--muted)]">{[company.sector, company.city, company.country].filter(Boolean).join(" · ") || "—"}</p>{company.overview && <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{company.overview}</p>}</div>
                <div className="text-right"><Badge color="brand">{company.contacts?.length || 0} {c.contacts}</Badge><p className="mt-2 text-[var(--brand)]">{expanded ? "▾" : "▸"}</p></div>
              </button>
              {expanded && <div className="border-t border-[var(--border)] bg-black/20 p-4">
                <div className="mb-3 flex flex-wrap gap-2"><Button href={`/companies/${company.id}`}>{c.openCompany}</Button>{company.website && <Button href={company.website} target="_blank" variant="secondary">Website</Button>}</div>
                <div className="grid gap-2">{(company.contacts || []).map((person) => <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 p-3"><div><p className="text-sm font-semibold">{person.full_name}</p><p className="text-xs text-[var(--muted)]">{person.job_title || "—"} · {person.phone || person.email || "—"}</p></div><div className="flex gap-2">{person.phone && <Button type="button" onClick={() => startTrackedCall(person, "Telefon")} variant="secondary">{t("contactCenter.startCall")}</Button>}<Button type="button" variant="secondary" onClick={() => setSelected({ contact: person, type: "Telefon" })}>{t("contactCenter.logResult")}</Button><Button href={`/contacts/${person.id}`} variant="secondary">{c.details}</Button></div></div>)}</div>
              </div>}
            </Card>;
          })}
        </div>
      ))}

      {tab === "recent" && (logs.length === 0 ? <EmptyState>{t("contactCenter.noCalls")}</EmptyState> : <div className="grid gap-3 md:grid-cols-2">{logs.map((log) => <Card key={log.id} className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{log.contact?.full_name || "—"}</p><p className="text-xs text-[var(--muted)]">{log.contact?.company?.name || "—"}</p></div><Badge color={log.outcome === "answered" ? "green" : "red"}>{t(`contactCenter.outcomes.${log.outcome || "answered"}`)}</Badge></div><p className="mt-2 text-sm text-zinc-300">{log.interaction_type}{log.note ? ` · ${log.note}` : ""}</p><p className="mt-2 text-xs text-zinc-600">{new Date(log.created_at).toLocaleString()} · {log.logger?.full_name || log.logger?.email || "—"}</p></Card>)}</div>)}

      {selected && <CallOutcomeModal contact={selected.contact} initialType={selected.type} relations={related[selected.contact.id] || []} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CallOutcomeModal({ contact, initialType = "Telefon", relations, onClose }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveCallOutcome, {});
  const [outcome, setOutcome] = useState("answered");
  const [relation, setRelation] = useState("");
  const selectedRelation = relations.find((item) => item.value === relation);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm md:items-center" onMouseDown={onClose}><Card className="max-h-[90vh] w-full max-w-2xl overflow-auto p-5" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{t("contactCenter.callOutcome")}</h2><p className="text-sm text-[var(--muted)]">{contact.full_name} · {contact.company?.name || "—"}</p></div><Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button></div><form action={action} className="grid gap-4 md:grid-cols-2"><input type="hidden" name="contact_id" value={contact.id} /><Field label={t("contactCenter.interactionType")}><Select name="interaction_type" defaultValue={initialType}><option>Telefon</option><option>Teams</option><option>Zoom</option><option>Google Meet</option><option>Yüz yüze</option><option>WhatsApp</option></Select></Field><Field label={t("contactCenter.result")}><Select name="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="answered">{t("contactCenter.outcomes.answered")}</option><option value="no_answer">{t("contactCenter.outcomes.no_answer")}</option></Select></Field>{outcome === "answered" && <Field label={t("contactCenter.relatedRecord")} className="md:col-span-2"><Select name="relation" value={relation} onChange={(event) => setRelation(event.target.value)}><option value="">{t("contactCenter.generalCall")}</option>{relations.map((item) => <option key={item.value} value={item.value}>{item.kind === "event" ? t("contactCenter.eventRecord") : t("contactCenter.leadRecord")} · {item.title}</option>)}</Select></Field>}{outcome === "answered" && selectedRelation?.kind === "event" && <Field label="RSVP"><Select name="rsvp" defaultValue={selectedRelation.rsvp || "pending"}><option value="yes">{t("rsvp.yes")}</option><option value="no">{t("rsvp.no")}</option><option value="maybe">{t("rsvp.maybe")}</option><option value="pending">{t("contactCenter.pending")}</option></Select></Field>}{outcome === "answered" && selectedRelation?.kind === "lead" && <><Field label={t("leadPipeline.probability")}><Select name="probability" defaultValue={selectedRelation.probability || "t70"}><option value="t90">T90</option><option value="t70">T70</option><option value="t50">T50</option></Select></Field><Field label={t("common.status")}><Select name="lead_status" defaultValue={selectedRelation.status || "meeting"}><option value="new">New</option><option value="contacted">Contacted</option><option value="meeting">Meeting</option><option value="postponed">Postponed</option><option value="won">Won</option><option value="lost">Lost</option></Select></Field><Field label={t("leadPipeline.reconnect")}><Input name="reconnect_at" type="datetime-local" defaultValue={selectedRelation.reconnectAt ? new Date(selectedRelation.reconnectAt).toISOString().slice(0,16) : ""} /></Field><Field label={t("leadPipeline.nextStep")}><Input name="next_step" defaultValue={selectedRelation.nextStep || ""} /></Field></>}<Field label={t("common.notes")} className="md:col-span-2"><Textarea name="note" rows={4} /></Field><div className="flex items-center gap-3 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>{state?.ok && <span className="text-sm text-emerald-300">{t("common.saved")}</span>}{state?.error && <span className="text-sm text-red-400">{state.error}</span>}</div></form></Card></div>;
}
