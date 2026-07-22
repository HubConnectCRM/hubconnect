"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.12),transparent_34%),var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-full">
        <aside className="sticky top-0 flex h-screen w-72 flex-none flex-col border-r border-white/10 bg-[#111827] text-white shadow-2xl">
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
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
                <p className="truncate text-sm font-semibold tracking-wide">HubConnect</p>
                <p className="text-xs text-indigo-200">{t("common.workspaceSubtitle")}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {items.map((item) => {
              const ActiveIcon = Icon[item.icon];
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all " +
                    (active
                      ? "bg-white text-[#111827] shadow-lg shadow-black/10"
                      : "text-indigo-100/90 hover:bg-white/10 hover:text-white")
                  }
                >
                  <span className={"flex h-8 w-8 items-center justify-center rounded-xl " + (active ? "bg-indigo-50 text-[var(--brand)]" : "bg-white/10 text-indigo-100 group-hover:bg-white/15")}>
                    {ActiveIcon ? <ActiveIcon /> : null}
                  </span>
                  <span className="font-medium">{t(`nav.${item.key}`)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</p>
                  <p className="truncate text-xs text-indigo-200">{t(`roles.${role}`)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-indigo-50 transition-colors hover:bg-white/15"
              >
                <Icon.logout />
                {t("common.signOut")}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-white/85 px-6 py-3 backdrop-blur-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">CRM v6</p>
              <p className="text-sm text-[var(--muted)]">{t("common.workflowSubtitle")}</p>
            </div>
            <LanguageSwitcher />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
      <IncomingCallListener profile={profile} />
    </div>
  );
}
