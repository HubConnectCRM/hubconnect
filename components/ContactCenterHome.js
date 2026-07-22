"use client";

import { useTranslation } from "react-i18next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import Link from "next/link";

const OPTIONS = [
  { href: "/mail", icon: "mail", title: "contactCenter.mailTitle", subtitle: "contactCenter.mailDescription" },
  { href: "/calls", icon: "phone", title: "contactCenter.callTitle", subtitle: "contactCenter.callDescription" },
  { href: "/calendar", icon: "calendar", title: "contactCenter.calendarTitle", subtitle: "contactCenter.calendarDescription" },
  { href: "/chat", icon: "chat", title: "chat.title", subtitle: "chat.subtitle" },
  { href: "/performance", icon: "performance", title: "performance.title", subtitle: "performance.subtitle" },
];

export default function ContactCenterHome({ stats, mailbosConnected, senderEmail }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="HQ" subtitle={t("contactCenter.subtitle")}>
        <Badge color={mailbosConnected ? "green" : "gray"}>
          {mailbosConnected ? t("contactCenter.mailbosConnected", { email: senderEmail || "MailBos" }) : t("contactCenter.mailbosDisconnected")}
        </Badge>
      </PageHeader>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat value={stats.callsToday} label={t("contactCenter.callsToday")} />
        <Stat value={stats.meetingsToday} label={t("contactCenter.meetingsToday")} />
        <Stat value={stats.contacts} label={t("contactCenter.totalContacts")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {OPTIONS.map((option) => {
          const ItemIcon = Icon[option.icon];
          return (
            <Link key={option.href} href={option.href}>
              <Card className="group h-full p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)]/50 hover:bg-[#1b1d18]">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-[var(--brand-ink)]"><ItemIcon width={25} height={25} /></span>
                <h2 className="mt-5 text-xl font-semibold">{t(option.title)}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t(option.subtitle)}</p>
                <p className="mt-5 text-sm font-semibold text-[var(--brand)]">{t("contactCenter.open")} →</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return <Card className="p-4"><p className="text-2xl font-semibold text-[var(--brand)]">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></Card>;
}
