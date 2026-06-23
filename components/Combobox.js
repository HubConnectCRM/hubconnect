"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Searchable select. Renders a hidden input[name] so it works inside <form>.
export default function Combobox({ options, value, onChange, placeholder, name }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value || ""} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm outline-none focus:border-[var(--brand)]"
      >
        <span className={selected ? "" : "text-[var(--muted)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-[var(--muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <ul className="max-h-60 overflow-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">
                {t("common.noResults")}
              </li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={
                      "block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--background)] " +
                      (o.value === value ? "text-[var(--brand)]" : "")
                    }
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
