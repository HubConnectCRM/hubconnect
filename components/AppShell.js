"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/lib/nav";
import { Icon } from "@/components/icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
    <div className="flex min-h-full flex-1">
      <aside className="flex w-60 flex-none flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold text-[var(--brand)]">
            {t("common.appName")}
          </span>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t("common.tagline")}</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((item) => {
            const ActiveIcon = Icon[item.icon];
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--foreground)] hover:bg-[var(--background)]")
                }
              >
                {ActiveIcon ? <ActiveIcon /> : null}
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile?.full_name || profile?.email}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {t(`roles.${role}`)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            <Icon.logout />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
