"use client";

import { useActionState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { setLanguage } from "@/i18n/I18nProvider";
import { LANGUAGES } from "@/i18n/config";
import {
  updateMyProfile,
  updateUserRole,
  toggleUserActive,
  addTeamMember,
  connectMailbos,
  disconnectMailbos,
} from "@/app/(app)/settings/actions";

const ROLES = ["admin", "sales", "event"];

export default function SettingsView({ profile, users, isAdmin, mailbosSenderEmail }) {
  const { t, i18n } = useTranslation();
  const [state, action, pending] = useActionState(updateMyProfile, {});

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("settings.title")} />

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("settings.profile")}</h2>
        <form action={action} className="max-w-md space-y-4">
          <Field label={t("common.email")}>
            <Input value={profile.email || ""} disabled />
          </Field>
          <Field label={t("common.fullName")}>
            <Input name="full_name" defaultValue={profile.full_name || ""} />
          </Field>
          <Field label={t("settings.language")}>
            <Select
              name="language"
              defaultValue={i18n.language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
            {state?.ok && <span className="text-sm text-green-700">{t("settings.saved")}</span>}
          </div>
        </form>
      </Card>

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("settings.mailbosTitle")}</h2>
        <MailbosConnect senderEmail={mailbosSenderEmail} />
      </Card>

      {isAdmin && (
        <Card className="overflow-hidden">
          <div className="p-5">
            <h2 className="text-lg font-semibold">{t("settings.users")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("settings.usersHint")}</p>
            <AddMember />
          </div>
          <table className="w-full text-sm">
            <thead className="border-y border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.fullName")}</th>
                <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                <th className="px-4 py-3 font-medium">{t("settings.role")}</th>
                <th className="px-4 py-3 font-medium">{t("settings.active")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === profile.id} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function UserRow({ user, isSelf }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="px-4 py-3 font-medium">
        {user.full_name || "—"}
        {isSelf && <span className="ml-2 text-xs text-[var(--muted)]">({t("settings.you")})</span>}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">{user.email}</td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateUserRole(user.id, e.target.value))
          }
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => toggleUserActive(user.id, !user.is_active))
          }
        >
          <Badge color={user.is_active ? "green" : "gray"}>
            {user.is_active ? t("common.yes") : t("common.no")}
          </Badge>
        </button>
      </td>
    </tr>
  );
}

function MailbosConnect({ senderEmail }) {
  const { t } = useTranslation();
  const [connectState, connectAction, connectPending] = useActionState(connectMailbos, {});
  const [disconnectPending, startDisconnect] = useTransition();
  const connected = !!(connectState?.senderEmail || senderEmail);
  const displayEmail = connectState?.senderEmail || senderEmail;

  if (connected) {
    return (
      <div>
        <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ {t("settings.mailbosConnected", { email: displayEmail })}
        </div>
        <Button
          variant="secondary"
          disabled={disconnectPending}
          onClick={() => startDisconnect(() => disconnectMailbos())}
        >
          {t("settings.mailbosDisconnect")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-[var(--muted)]">{t("settings.mailbosHint")}</p>
      <form action={connectAction} className="flex flex-wrap items-end gap-3 max-w-lg">
        <div className="flex-1 min-w-64">
          <Field label={t("settings.mailbosKeyLabel")}>
            <Input name="api_key" type="password" placeholder="mbk_…" required />
          </Field>
        </div>
        <Button type="submit" disabled={connectPending}>
          {connectPending ? t("common.saving") : t("settings.mailbosConnect")}
        </Button>
      </form>
      {connectState?.error === "invalid_key" && (
        <p className="mt-2 text-sm text-red-700">{t("settings.mailbosInvalidKey")}</p>
      )}
      {connectState?.error === "invalid_key_format" && (
        <p className="mt-2 text-sm text-red-700">{t("settings.mailbosInvalidKey")}</p>
      )}
      {connectState?.error === "mailbos_unreachable" && (
        <p className="mt-2 text-sm text-red-700">{t("settings.mailbosUnreachable")}</p>
      )}
    </div>
  );
}

function AddMember() {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addTeamMember, {});

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
      <p className="mb-3 text-sm font-medium">{t("settings.addMember")}</p>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <Field label={t("common.fullName")}>
            <Input name="full_name" />
          </Field>
        </div>
        <div className="min-w-48 flex-1">
          <Field label={t("common.email")}>
            <Input name="email" type="email" required />
          </Field>
        </div>
        <div className="w-40">
          <Field label={t("settings.role")}>
            <Select name="role" defaultValue="sales">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.add")}
        </Button>
      </form>
      <p className="mt-2 text-xs text-[var(--muted)]">{t("settings.addMemberHint")}</p>
      {state?.error === "no_service_key" && (
        <p className="mt-2 text-sm text-red-700">{t("settings.noServiceKey")}</p>
      )}
      {state?.error && state.error !== "no_service_key" && (
        <p className="mt-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <p>{t("settings.shareCredentials", { email: state.email })}</p>
          <p className="mt-1 font-mono">
            {t("settings.tempPassword")}: {state.tempPassword}
          </p>
        </div>
      )}
    </div>
  );
}
