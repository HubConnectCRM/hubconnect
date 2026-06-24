"use client";

import { useActionState, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { sendWithMailbos } from "@/app/(app)/mail/actions";

export default function MailCenterView({ connected, senderEmail, messages }) {
  const { t } = useTranslation();

  if (!connected) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title={t("mail.title")} subtitle={t("mail.subtitle")} />
        <Card className="p-8 text-center">
          <p className="text-lg font-semibold mb-2">{t("mail.notConnected")}</p>
          <p className="text-sm text-[var(--muted)] mb-4">{t("mail.connectHint")}</p>
          <Button href="/settings">{t("mail.goToSettings")}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("mail.title")} subtitle={t("mail.connectedSubtitle", { email: senderEmail || "?" })}>
        <Button href="/settings" variant="secondary">{t("mail.manageConnection")}</Button>
      </PageHeader>

      <SendMailForm />

      <h2 className="mt-6 mb-3 text-lg font-semibold">{t("mail.sent")} ({messages.length})</h2>

      {messages.length === 0 ? (
        <EmptyState>{t("mail.emptySent")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                <th className="px-4 py-3 font-medium">{t("mail.subject")}</th>
                <th className="px-4 py-3 font-medium">{t("mail.contact")}</th>
                <th className="px-4 py-3 font-medium">{t("mail.status")}</th>
                <th className="px-4 py-3 font-medium">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{m.to_email}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{m.subject || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {m.contact ? (
                      <a href={`/contacts/${m.contact.id}`} className="hover:underline text-[var(--brand)]">
                        {m.contact.full_name}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.replied ? (
                      <Badge color="green">{t("mail.replied")}</Badge>
                    ) : m.opened ? (
                      <Badge color="amber">{t("mail.opened")}</Badge>
                    ) : (
                      <Badge color="gray">{t("mail.sent_badge")}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {new Date(m.sent_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SendMailForm() {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(sendWithMailbos, {});
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--muted)]">{t("mail.compose")}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-[var(--brand)] hover:underline"
        >
          {open ? t("common.cancel") : t("mail.newMail")}
        </button>
      </div>
      {open && (
        <form action={action} className="mt-4 space-y-3">
          <Field label={t("mail.to")}>
            <Input name="to" type="email" required />
          </Field>
          <Field label={t("mail.subject")}>
            <Input name="subject" required />
          </Field>
          <Field label={t("mail.body")}>
            <Textarea name="body" rows={5} required />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("mail.send")}
            </Button>
            {state?.ok && <span className="text-sm text-green-700">{t("mail.sentOk")}</span>}
            {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
          </div>
        </form>
      )}
    </Card>
  );
}
