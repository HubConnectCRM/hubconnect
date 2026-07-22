"use client";

import Link from "next/link";

export function Button({ variant = "primary", className = "", as, href, ...props }) {
  const variants = {
    primary: "bg-[var(--brand)] text-[var(--brand-ink)] hover:brightness-95",
    secondary:
      "border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--foreground)] hover:border-white/20 hover:bg-[#272922]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--foreground)]",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} {...props} />
    );
  }
  return <button className={cls} {...props} />;
}

export function Field({ label, hint, children, required, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[#d9fa84]/10";

export function Input({ className = "", ...props }) {
  return <input className={`${inputCls} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`${inputCls} min-h-20 resize-y ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${inputCls} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]"
        {...props}
      />
      {label}
    </label>
  );
}

export function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-black/20">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[var(--muted)]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const badgeColors = {
  gray: "bg-white/10 text-zinc-200",
  brand: "bg-[#d9fa84]/15 text-[var(--brand)]",
  green: "bg-emerald-400/15 text-emerald-300",
  amber: "bg-amber-400/15 text-amber-300",
  red: "bg-red-400/15 text-red-300",
  blue: "bg-sky-400/15 text-sky-300",
  pink: "bg-pink-400/15 text-pink-300",
  purple: "bg-violet-400/15 text-violet-300",
};

export function Badge({ color = "gray", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[color] || badgeColors.gray}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--muted)] shadow-sm">
      {children}
    </div>
  );
}

export function Avatar({ name, size = 8 }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-[var(--brand)] font-semibold text-[var(--brand-ink)]"
      style={{ width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.4}px` }}
    >
      {initials}
    </span>
  );
}
