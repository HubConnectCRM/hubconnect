// Sidebar navigation. `roles` limits visibility; omit to show to everyone.
export const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard" },
  { key: "contacts", href: "/contacts", icon: "contacts" },
  { key: "companies", href: "/companies", icon: "companies" },
  { key: "events", href: "/events", icon: "events" },
  { key: "import", href: "/import", icon: "import", roles: ["admin", "sales", "event"] },
  { key: "audit", href: "/audit", icon: "audit", roles: ["admin"] },
  { key: "settings", href: "/settings", icon: "settings" },
];
