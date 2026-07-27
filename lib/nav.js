// Sidebar navigation. `roles` limits visibility; omit to show to everyone.
export const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard" },
  { key: "sales", href: "/sales", icon: "sales", roles: ["admin", "sales"] },
  { key: "events", href: "/events", icon: "events", roles: ["admin", "events"] },
  { key: "leads", href: "/leads", icon: "sales", roles: ["admin", "sales"] },
  { key: "cost", href: "/cost", icon: "cost", roles: ["admin", "sales"] },
  { key: "accreditation", href: "/accreditation", icon: "contacts", section: "more", roles: ["admin", "events", "sales"] },
  { key: "contacts", href: "/contacts", icon: "contacts", section: "more" },
  { key: "companies", href: "/companies", icon: "companies", section: "more" },
  { key: "hq", href: "/contact-center", icon: "hq", section: "more", roles: ["admin", "sales", "events"] },
  { key: "calls", href: "/calls", icon: "calls", section: "more", roles: ["admin", "sales", "events"] },
  { key: "journal", href: "/journal", icon: "journal", section: "more" },
  { key: "import", href: "/import", icon: "import", section: "more", roles: ["admin", "sales", "events"] },
  { key: "notifications", href: "/notifications", icon: "notifications", section: "more", roles: ["admin", "sales", "events"] },
  { key: "audit", href: "/audit", icon: "audit", section: "more", roles: ["admin"] },
  { key: "settings", href: "/settings", icon: "settings", section: "more" },
];
