"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setInfo(t("login.checkEmail"));
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err?.message || t("login.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-[var(--brand)]">
            {t("common.appName")}
          </span>
          <LanguageSwitcher />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
          <h1 className="text-xl font-semibold">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("login.subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field
                label={t("common.fullName")}
                type="text"
                value={fullName}
                onChange={setFullName}
                required
              />
            )}
            <Field
              label={t("common.email")}
              type="email"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              label={t("common.password")}
              type="password"
              value={password}
              onChange={setPassword}
              required
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? t("common.loading")
                : mode === "signin"
                  ? t("login.signInButton")
                  : t("login.signUpButton")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setInfo("");
            }}
            className="mt-4 w-full text-center text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {mode === "signin" ? t("login.needAccount") : t("login.haveAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
      />
    </label>
  );
}
