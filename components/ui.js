"use client";

import Link from "next/link";

export function Button({ variant = "primary", className = "", as, href, ...props }) {
  const variants = {
    primary: "bg-[var(--brand)] text-white hover:opacity-90",
    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} {...props} />
    );
  }
  return <button className={cls} {...props} />;
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="block">
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
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]";

export function Input(props) {
  return <input className={inputCls} {...props} />;
}

export function Textarea(props) {
  return <textarea className={`${inputCls} min-h-20 resize-y`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={inputCls} {...props}>
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
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-[var(--muted)]">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

const badgeColors = {
  gray: "bg-zinc-100 text-zinc-700",
  brand: "bg-indigo-100 text-indigo-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  pink: "bg-pink-100 text-pink-700",
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
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
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
      className="flex flex-none items-center justify-center rounded-full bg-[var(--brand)] font-semibold text-white"
      style={{ width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.4}px` }}
    >
      {initials}
    </span>
  );
}
