"use client";

import { useActionState } from "react";
import { useTranslation } from "react-i18next";
import { saveCompany } from "@/app/(app)/companies/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

export default function CompanyForm({ company }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveCompany, {});

  return (
    <form action={action} className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" href="/companies">
          ← {t("common.back")}
        </Button>
        <h1 className="text-2xl font-semibold">
          {company?.id ? t("companies.edit") : t("companies.new")}
        </h1>
      </div>
      {company?.id && <input type="hidden" name="id" value={company.id} />}
      <Card className="space-y-4 p-6">
        <Field label={t("common.name")} required>
          <Input name="name" defaultValue={company?.name || ""} required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("companies.sector")}>
            <Input name="sector" defaultValue={company?.sector || ""} />
          </Field>
          <Field label={t("common.website")}>
            <Input name="website" defaultValue={company?.website || ""} />
          </Field>
          <Field label={t("common.country")}>
            <Input name="country" defaultValue={company?.country || ""} />
          </Field>
          <Field label={t("common.city")}>
            <Input name="city" defaultValue={company?.city || ""} />
          </Field>
        </div>
        <Field label={t("companies.overview")}>
          <Textarea name="overview" defaultValue={company?.overview || ""} />
        </Field>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error === "name_required" ? t("common.required") : state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" href="/companies">
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
