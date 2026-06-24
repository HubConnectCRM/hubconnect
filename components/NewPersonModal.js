"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createPerson, previewCompanyEnrichment } from "@/app/(app)/contacts/actions";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import Combobox from "@/components/Combobox";

export default function NewPersonModal({
  open,
  onClose,
  companies = [],
  owners = [],
  leadFiles = [],
  groups = [],
  defaultLeadFileId = "",
  dealId = "",
  title,
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(createPerson, {});
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyOverview, setCompanyOverview] = useState("");
  const [email, setEmail] = useState("");
  const [leadFileValue, setLeadFileValue] = useState(defaultLeadFileId || "");
  const [groupId, setGroupId] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [enrichState, setEnrichState] = useState(null);
  const [enrichPending, startEnrich] = useTransition();

  useEffect(() => {
    if (open) {
      setLeadFileValue(defaultLeadFileId || "");
      setGroupId("");
      setEnrichState(null);
    }
  }, [open, defaultLeadFileId]);

  useEffect(() => {
    if (state?.ok) {
      setCompanyName("");
      setCompanyWebsite("");
      setCompanyOverview("");
      setEmail("");
      setGroupId("");
      setFormKey((k) => k + 1);
      router.refresh();
      onClose?.();
    }
  }, [state?.ok, router, onClose]);

  const companyOpts = useMemo(() => companies.map((c) => ({ value: c.name, label: c.name })), [companies]);
  const fileOpts = useMemo(() => leadFiles.map((f) => ({ value: f.id, label: f.name })), [leadFiles]);
  const isExistingFile = leadFiles.some((f) => f.id === leadFileValue);
  const groupOpts = groups
    .filter((g) => g.lead_file_id === (isExistingFile ? leadFileValue : defaultLeadFileId))
    .map((g) => ({ value: g.id, label: g.name }));

  function enrichCompany() {
    const hint = companyWebsite || email;
    setEnrichState(null);
    startEnrich(async () => {
      const res = await previewCompanyEnrichment(companyName, hint);
      setEnrichState(res);
      if (res?.ok) {
        if (res.website) setCompanyWebsite(res.website);
        if (res.overview) setCompanyOverview(res.overview);
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{title || "New person"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add a person and their company in one form. If you provide a website or email domain, HubConnect can build a free scraped company cache.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-[var(--muted)] hover:bg-[var(--background)]">×</button>
        </div>

        <form key={formKey} action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="company_name" value={companyName} />
          <input type="hidden" name="company_website" value={companyWebsite} />
          <input type="hidden" name="company_overview" value={companyOverview} />
          <input type="hidden" name="deal_id" value={dealId || ""} />
          <input type="hidden" name="lead_file_id" value={isExistingFile || defaultLeadFileId ? (isExistingFile ? leadFileValue : defaultLeadFileId) : ""} />
          <input type="hidden" name="lead_file_name" value={!isExistingFile && !defaultLeadFileId ? leadFileValue : ""} />
          <input type="hidden" name="group_id" value={groupId} />

          <Field label="Full name" required>
            <Input name="full_name" placeholder="Kübra Nermin Sarp" autoFocus />
          </Field>
          <Field label="Job title">
            <Input name="job_title" placeholder="Buyer, Marketing Manager, CEO..." />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="Phone">
            <Input name="phone" placeholder="+39 ..." />
          </Field>

          <div className="sm:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Company</p>
                <p className="text-xs text-[var(--muted)]">Pick an existing company or type a new one. New companies are created automatically.</p>
              </div>
              {companyOverview && <Badge color="green">Cache ready</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Company name" className="sm:col-span-2">
                <Combobox options={companyOpts} value={companyName} onChange={setCompanyName} placeholder="Pick or type a company" allowCustom />
              </Field>
              <Field label="Website / domain" hint="Optional, but needed for free scraping. Email domain also works.">
                <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://company.com" />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={enrichCompany} disabled={enrichPending || !companyName || (!companyWebsite && !email)} className="w-full">
                  {enrichPending ? "Searching..." : "Search company info"}
                </Button>
              </div>
              {companyOverview && (
                <Field label="Company cache preview" className="sm:col-span-2">
                  <Textarea value={companyOverview} onChange={(e) => setCompanyOverview(e.target.value)} rows={3} />
                </Field>
              )}
              {enrichState?.error && <p className="sm:col-span-2 text-xs text-amber-700">Could not scrape automatically: {enrichState.error}. You can still create the person/company.</p>}
            </div>
          </div>

          <Field label="LinkedIn">
            <Input name="linkedin" placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Owner">
            <Select name="owner_id" defaultValue="">
              <option value="">Me</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
            </Select>
          </Field>

          {!defaultLeadFileId && !dealId && (
            <Field label="Lead file" className="sm:col-span-2" hint="Optional. Pick an existing file or type a new one.">
              <Combobox options={fileOpts} value={leadFileValue} onChange={(v) => { setLeadFileValue(v); setGroupId(""); }} placeholder="No lead file / pick or create" allowCustom />
            </Field>
          )}
          {defaultLeadFileId && groupOpts.length > 0 && (
            <Field label="Group">
              <Combobox options={groupOpts} value={groupId} onChange={setGroupId} placeholder="No group" />
            </Field>
          )}
          {dealId && (
            <Field label="RSVP">
              <Select name="rsvp" defaultValue="">
                <option value="">Unknown</option>
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </Select>
            </Field>
          )}
          <Field label="Source">
            <Input name="source" placeholder="manual, sales, LinkedIn, event list..." />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="notes" rows={3} placeholder="Context, interest, outreach note..." />
          </Field>

          {state?.error && <p className="sm:col-span-2 text-sm text-red-700">{state.error === "name_required" ? "Name is required." : state.error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? t("common.saving") : "Create person"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
