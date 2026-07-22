"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { getInboxMessage, sendWithMailbos } from "@/app/(app)/mail/actions";
import { connectMailbos } from "@/app/(app)/settings/actions";

function stripHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export default function MailCenterView({ connected, senderEmail, provider, messages, inbox, contacts, liveError, initialRecipient = "", mailbosKeyId = "" }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("sent");
  const [selectedInbox, setSelectedInbox] = useState(null);
  const [selectedSent, setSelectedSent] = useState(null);

  if (!connected) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t("mail.title")} subtitle={t("mail.subtitle")} />
        <Card className="p-8">
          <div className="text-center">
          <p className="mb-2 text-lg font-semibold">{t("mail.notConnected")}</p>
          <p className="mb-4 text-sm text-[var(--muted)]">{t("mail.connectHint")}</p>
          </div>
          <MailbosInlineConnect />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("mail.title")} subtitle={t("mail.connectedSubtitle", { email: senderEmail || "MailBos" })}>
        <Badge color="brand">{provider === "outlook" ? "Outlook" : "Gmail"}</Badge>
        <Button href="/contact-center" variant="secondary">{t("contactCenter.backToCenter")}</Button>
        <Button href="/settings" variant="secondary">{t("mail.manageConnection")}</Button>
      </PageHeader>

      {liveError && (
        <Card className="mb-4 border-amber-400/30 p-4 text-sm text-amber-300">
          {t("mail.liveFallback")}
        </Card>
      )}

      <SendMailForm contacts={contacts} initialRecipient={initialRecipient} mailbosKeyId={mailbosKeyId} />

      <div className="mb-4 mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
        {["sent", "inbox"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-[var(--muted)] hover:text-white"}`}
          >
            {t(`mail.${value}`)} ({value === "sent" ? messages.length : inbox.length})
          </button>
        ))}
      </div>

      {tab === "sent" ? (
        <SentList messages={messages} onOpen={setSelectedSent} />
      ) : (
        <InboxList messages={inbox} onOpen={setSelectedInbox} />
      )}

      {selectedInbox && (
        <InboxDetail message={selectedInbox} onClose={() => setSelectedInbox(null)} />
      )}
      {selectedSent && <SentDetail message={selectedSent} onClose={() => setSelectedSent(null)} />}
    </div>
  );
}

function MailbosInlineConnect() {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(connectMailbos, {});
  useEffect(() => { if (state?.ok) router.refresh(); }, [state?.ok, router]);
  return (
    <form action={action} className="mx-auto mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={t("settings.mailbosKeyLabel")} className="flex-1">
        <Input name="api_key" type="password" placeholder="MailBos API key" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("settings.mailbosConnect")}</Button>
      {state?.error && <p className="text-sm text-red-400 sm:w-full">{state.error === "invalid_key" ? t("settings.mailbosInvalidKey") : t("settings.mailbosUnreachable")}</p>}
      {state?.ok && <p className="text-sm text-emerald-300 sm:w-full">{t("settings.mailbosConnected", { email: state.senderEmail || "MailBos" })}</p>}
    </form>
  );
}

function SentList({ messages, onOpen }) {
  const { t } = useTranslation();
  if (messages.length === 0) return <EmptyState>{t("mail.emptySent")}</EmptyState>;

  return (
    <div className="grid gap-3">
      {messages.map((message) => (
        <button key={message.id} type="button" onClick={() => onOpen(message)} className="text-left"><Card className="p-4 transition hover:border-[var(--brand)]/40 hover:bg-[#1b1d18]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{message.subject || t("mail.noSubject")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{message.to_email}</p>
              {message.body_preview && <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{stripHtml(message.body_preview)}</p>}
            </div>
            <div className="flex items-center gap-2">
              {message.replied ? <Badge color="green">{t("mail.replied")}</Badge> : message.opened ? <Badge color="amber">{t("mail.opened")}</Badge> : <Badge>{t("mail.sent_badge")}</Badge>}
              <span className="text-xs text-[var(--muted)]">{message.sent_at ? new Date(message.sent_at).toLocaleString() : ""}</span>
            </div>
          </div>
        </Card></button>
      ))}
    </div>
  );
}

function SentDetail({ message, onClose }) {
  const { t } = useTranslation();
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center" onMouseDown={onClose}><Card className="max-h-[85vh] w-full max-w-3xl overflow-auto p-5" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4"><div><h2 className="text-xl font-semibold">{message.subject || t("mail.noSubject")}</h2><p className="mt-1 text-sm text-[var(--muted)]">→ {message.to_email}</p></div><Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button></div><div className="whitespace-pre-wrap py-5 text-sm leading-7 text-zinc-200">{stripHtml(message.body || message.body_preview) || "—"}</div></Card></div>;
}

function InboxList({ messages, onOpen }) {
  const { t } = useTranslation();
  if (messages.length === 0) return <EmptyState>{t("mail.emptyInbox")}</EmptyState>;

  return (
    <div className="grid gap-3">
      {messages.map((message) => {
        const name = message.fromName || message.fromEmail || "—";
        return (
          <button key={message.id} type="button" onClick={() => onOpen(message)} className="text-left">
            <Card className="p-4 transition hover:border-[var(--brand)]/40 hover:bg-[#1b1d18]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{name}</p>
                    {message.isContact && <Badge color="brand">{t("mail.knownContact")}</Badge>}
                    {message.isSpam && <Badge color="red">Spam</Badge>}
                  </div>
                  <p className="mt-1 truncate text-sm">{message.subject || t("mail.noSubject")}</p>
                  {message.preview && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{stripHtml(message.preview)}</p>}
                </div>
                <span className="whitespace-nowrap text-xs text-[var(--muted)]">{message.date ? new Date(message.date).toLocaleString() : ""}</span>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

function InboxDetail({ message, onClose }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getInboxMessage(message.id, message.provider);
      if (result?.ok) setDetail(result.message);
      else setError(result?.error || "mailbos_unreachable");
    });
  }, [message.id, message.provider]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center" onMouseDown={onClose}>
      <Card className="max-h-[85vh] w-full max-w-3xl overflow-auto p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-xl font-semibold">{detail?.subject || message.subject || t("mail.noSubject")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail?.from || message.fromEmail}</p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        </div>
        <div className="whitespace-pre-wrap py-5 text-sm leading-7 text-zinc-200">
          {pending ? t("common.loading") : error ? t("mail.detailError") : stripHtml(detail?.body || message.preview)}
        </div>
      </Card>
    </div>
  );
}

function SendMailForm({ contacts, initialRecipient = "", mailbosKeyId = "" }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(sendWithMailbos, {});
  const [open, setOpen] = useState(!!initialRecipient);
  const [recipient, setRecipient] = useState(initialRecipient);
  const contact = useMemo(() => contacts.find((item) => item.email?.toLowerCase() === recipient.toLowerCase()), [contacts, recipient]);

  function campaignUrl() {
    if (!contact) return "https://mailbos.app/app";
    const payload = JSON.stringify({ name: contact.full_name || "", email: contact.email, company: contact.company?.name || "", position: "" });
    const bytes = new TextEncoder().encode(payload);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const returnUrl = `${window.location.origin}/mail`;
    return `https://mailbos.app/app?ext_contact=${encoded}&ext_key_id=${encodeURIComponent(mailbosKeyId)}&ext_return=${encodeURIComponent(returnUrl)}`;
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{t("mail.compose")}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{t("mail.composeHint")}</p>
        </div>
        <Button type="button" variant={open ? "secondary" : "primary"} onClick={() => setOpen((value) => !value)}>
          {open ? t("common.cancel") : t("mail.newMail")}
        </Button>
      </div>
      {open && (
        <form action={action} className="mt-5 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="contact_id" value={contact?.id || ""} />
          <Field label={t("mail.to")} className="md:col-span-2">
            <Input name="to" type="email" list="mail-contact-options" value={recipient} onChange={(event) => setRecipient(event.target.value)} required />
            <datalist id="mail-contact-options">
              {contacts.map((item) => <option key={item.id} value={item.email}>{item.full_name} · {item.company?.name || ""}</option>)}
            </datalist>
          </Field>
          <Field label={t("mail.subject")} className="md:col-span-2"><Input name="subject" required /></Field>
          <Field label={t("mail.body")} className="md:col-span-2"><Textarea name="body" rows={7} required /></Field>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("mail.send")}</Button>
            <Button type="button" variant="secondary" disabled={!recipient} onClick={() => window.open(campaignUrl(), "_blank", "noopener,noreferrer")}>MailBos Campaigns ↗</Button>
            {state?.ok && <span className="text-sm text-emerald-300">{t("mail.sentOk")}</span>}
            {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
          </div>
        </form>
      )}
    </Card>
  );
}
