"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/lib/nav";
import { Icon } from "@/components/icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import IncomingCallListener from "@/components/calls/IncomingCallListener";

export default function AppShell({ profile, children }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreOpen, setMoreOpen] = useState(true);

  const role = profile?.role || "sales";
  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initials = (profile?.full_name || profile?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const primaryItems = items.filter((item) => item.section !== "more");
  const moreItems = items.filter((item) => item.section === "more");

  function NavItem({ item, compact = false }) {
    const ActiveIcon = Icon[item.icon];
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        className={
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all " +
          (active
            ? "bg-[var(--brand)] text-[var(--brand-ink)]"
            : "text-zinc-400 hover:bg-white/[0.06] hover:text-white") +
          (compact ? " py-2" : "")
        }
      >
        <span className={"flex h-8 w-8 items-center justify-center rounded-xl " + (active ? "bg-black/10" : "bg-white/[0.06]")}>
          {ActiveIcon ? <ActiveIcon /> : null}
        </span>
        <span className="font-medium">{t(`nav.${item.key}`)}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-full bg-black text-[var(--foreground)]">
      <div className="flex min-h-full">
        <aside className="sticky top-0 hidden h-screen w-72 flex-none flex-col border-r border-white/10 bg-[#090a08] text-white lg:flex">
          <div className="px-5 pb-5 pt-5">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
                <Image
                  src="/logo.png"
                  alt={t("common.appName")}
                  width={112}
                  height={34}
                  className="h-7 w-auto object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-wide">Hub Connect</p>
                <p className="text-xs text-zinc-500">{t("web.workspace")}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3">
            <div className="space-y-1">{primaryItems.map((item) => <NavItem key={item.key} item={item} />)}</div>
            <div className="my-4 h-px bg-white/10" />
            <button type="button" onClick={() => setMoreOpen((v) => !v)} className="mb-2 flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
              <span>{t("nav.more")}</span><span>{moreOpen ? "−" : "+"}</span>
            </button>
            {moreOpen && <div className="space-y-1">{moreItems.map((item) => <NavItem key={item.key} item={item} compact />)}</div>}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</p>
                  <p className="truncate text-xs text-zinc-500">{t(`roles.${role}`)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10"
              >
                <Icon.logout />
                {t("common.signOut")}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/85 px-4 py-3 backdrop-blur-xl md:px-7">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white"><Image src="/logo.png" alt="Retail Hub" width={90} height={30} className="h-6 w-auto object-contain" /></div>
              <span className="font-semibold">Hub Connect</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">{t("web.crm")}</p>
              <p className="text-sm text-[var(--muted)]">{t("web.liveData")}</p>
            </div>
            <div className="flex items-center gap-3"><Link href="/notifications" className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-[var(--brand)]"><Icon.notifications /></Link><LanguageSwitcher /></div>
          </header>
          <main className="flex-1 overflow-auto p-4 pb-24 md:p-7 lg:pb-7">{children}</main>
        </div>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.75rem] border border-white/10 bg-[#181916]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl lg:hidden">
        {primaryItems.slice(0, 4).map((item) => {
          const ActiveIcon = Icon[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return <Link key={item.key} href={item.href} className={"flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] " + (active ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-zinc-400")}><ActiveIcon width={17} height={17} /><span>{t(`nav.${item.key}`)}</span></Link>;
        })}
        <Link href="/contacts" className={"flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] " + (moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")) ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-zinc-400")}><Icon.audit width={17} height={17} /><span>{t("nav.more")}</span></Link>
      </nav>
      <IncomingCallListener profile={profile} />
    </div>
  );
}
