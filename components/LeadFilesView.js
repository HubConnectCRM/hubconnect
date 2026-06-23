"use client";

import { useActionState, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { saveLeadFile } from "@/app/(app)/leads/actions";

export default function LeadFilesView({ files }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("leads.title")} subtitle={t("leads.subtitle")}>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("leads.new")}
        </Button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6 p-5">
          <LeadFileForm onCancel={() => setShowForm(false)} />
        </Card>
      )}

      {files.length === 0 && !showForm ? (
        <EmptyState>{t("leads.empty")}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {files.map((f) => (
            <a
              key={f.id}
              href={`/leads/${f.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{f.name}</h3>
                <Badge color="blue">
                  {f.contactCount} {t("import.rows")}
                </Badge>
              </div>
              {f.description && (
                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{f.description}</p>
              )}
              <p className="mt-2 text-xs text-[var(--muted)]">
                {new Date(f.created_at).toLocaleDateString()}
                {f.created_by?.full_name && ` · ${f.created_by.full_name}`}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadFileForm({ file, onCancel }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveLeadFile, {});

  return (
    <form action={action} className="space-y-4 max-w-lg">
      {file && <input type="hidden" name="id" value={file.id} />}
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={file?.name || ""} required />
      </Field>
      <Field label={t("leads.description")}>
        <Textarea name="description" defaultValue={file?.description || ""} rows={2} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : file ? t("common.save") : t("common.create")}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
