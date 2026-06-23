"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { addRep, removeRep, updateRep } from "@/app/(app)/deals/actions";

// Editable representatives table for a deal. Used in both Leads and Sales.
export function RepsTable({ reps, leadFileId }) {
  const { t } = useTranslation();
  if (!reps || reps.length === 0) return null;
  return (
    <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t("deals.rep")}</th>
            <th className="px-3 py-2 font-medium">{t("common.email")}</th>
            <th className="px-3 py-2 font-medium">{t("common.phone")}</th>
            <th className="px-3 py-2 font-medium">{t("rsvp.label")}</th>
            <th className="px-3 py-2 font-medium">{t("common.notes")}</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {reps.map((r) => <RepRow key={r.id} rep={r} leadFileId={leadFileId} />)}
        </tbody>
      </table>
    </div>
  );
}

function RepRow({ rep, leadFileId }) {
  const { t } = useTranslation();
  const c = rep.contact || {};
  const [rsvp, setRsvp] = useState(rep.rsvp || "");
  const [notes, setNotes] = useState(rep.notes || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggleRsvp(v) {
    const next = rsvp === v ? "" : v;
    setRsvp(next);
    startTransition(() => updateRep(rep.id, { rsvp: next || null }, leadFileId));
  }
  function saveNotes() {
    startTransition(async () => {
      await updateRep(rep.id, { notes }, leadFileId);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    });
  }
  const activeCls = { yes: "bg-green-600 text-white", no: "bg-red-600 text-white", maybe: "bg-amber-500 text-white" };

  return (
    <tr className="border-b border-[var(--border)] last:border-0 align-top">
      <td className="px-3 py-2 font-medium">
        <a href={`/contacts/${c.id}`} className="hover:underline">{c.full_name || "—"}</a>
        {c.job_title && <span className="block text-xs text-[var(--muted)]">{c.job_title}</span>}
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{c.email || "—"}</td>
      <td className="px-3 py-2 text-[var(--muted)]">{c.phone || "—"}</td>
      <td className="px-3 py-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
          {["yes", "no", "maybe"].map((v) => (
            <button key={v} type="button" disabled={pending} onClick={() => toggleRsvp(v)}
              className={"px-2 py-0.5 text-xs transition-colors " + (rsvp === v ? activeCls[v] : "text-[var(--muted)] hover:bg-[var(--background)]")}>
              {t(`rsvp.${v}`)}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
            placeholder={t("deals.notePlaceholder")}
            className="w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--brand)]" />
          {saved && <span className="text-xs text-green-700">✓</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button type="button" disabled={pending} onClick={() => startTransition(() => removeRep(rep.id, leadFileId))}
          className="text-xs text-red-600 hover:underline">{t("common.delete")}</button>
      </td>
    </tr>
  );
}

// Add-representative form: pick an existing contact or create a new person
// (which becomes a real contact in the shared pool under the deal's company).
export function AddRepForm({ dealId, leadFileId, contacts, source = "sales" }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addRep, {});
  const [mode, setMode] = useState("existing"); // existing | new
  const [contactId, setContactId] = useState("");

  useEffect(() => { if (state?.ok) setContactId(""); }, [state?.ok]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-semibold text-[var(--muted)]">{t("deals.addRep")}</p>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
          {["existing", "new"].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={"px-2 py-0.5 text-xs transition-colors " + (mode === m ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[var(--background)]")}>
              {t(`deals.${m === "existing" ? "repExisting" : "repNew"}`)}
            </button>
          ))}
        </div>
      </div>
      <form key={mode + (state?.ok || "")} action={action}>
        <input type="hidden" name="deal_id" value={dealId} />
        <input type="hidden" name="lead_file_id" value={leadFileId || ""} />
        <input type="hidden" name="source" value={source} />
        {mode === "existing" ? (
          <div className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="contact_id" value={contactId} />
            <div className="min-w-56 flex-1">
              <Combobox name="_rep_display" options={contactOpts} value={contactId} onChange={setContactId} placeholder={t("events.pickContact")} />
            </div>
            <Button type="submit" disabled={pending || !contactId}>{t("common.add")}</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("common.fullName")} required>
                <Input name="full_name" placeholder={t("common.fullName")} />
              </Field>
              <Field label={t("contacts.company")}>
                <Input name="company_name" placeholder={t("deals.repCompanyHint")} />
              </Field>
              <Field label={t("contacts.jobTitle")}>
                <Input name="job_title" />
              </Field>
              <Field label={t("common.email")}>
                <Input name="email" type="email" />
              </Field>
              <Field label={t("common.phone")}>
                <Input name="phone" />
              </Field>
              <Field label={t("contacts.linkedin")}>
                <Input name="linkedin" placeholder="https://linkedin.com/in/…" />
              </Field>
            </div>
            <div className="mt-2">
              <Button type="submit" disabled={pending}>{t("common.add")}</Button>
            </div>
          </>
        )}
        {state?.error === "already_added" && <p className="mt-1 text-xs text-amber-700">{t("deals.repAlready")}</p>}
        {state?.error === "name_required" && <p className="mt-1 text-xs text-red-700">{t("common.required")}</p>}
      </form>
    </div>
  );
}
