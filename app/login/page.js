"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
        if (error) throw error;
        setInfo(t("login.resetSent"));
      } else {
        if (password.length < 8) throw new Error(t("login.passwordLength"));
        const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ fullName, email, password, inviteCode }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.msg || payload.message || payload.error || t("login.registrationFailed"));
        setInfo(t("login.registrationComplete"));
        setMode("signin");
      }
    } catch (err) {
      setError(err?.message || t("login.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-black px-6 py-16">
      <div className="pointer-events-none absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[var(--brand)]/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex items-center justify-between">
          <span className="flex items-center gap-3 text-lg font-semibold"><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white"><Image src="/logo.png" alt="Retail Hub" width={100} height={35} className="h-7 w-auto object-contain" priority /></span><span>Hub Connect</span></span>
          <LanguageSwitcher />
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl shadow-black">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--brand)]">{t("login.internalWorkspace")}</p>
          <h1 className="mt-2 text-2xl font-semibold">{mode === "signup" ? t("login.employeeRegistration") : mode === "reset" ? t("login.resetTitle") : t("login.welcomeBack")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{mode === "signup" ? t("login.registrationHint") : mode === "reset" ? t("login.resetHint") : t("login.secureHint")}</p>

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
            {mode !== "reset" && <Field
              label={t("common.password")}
              type="password"
              value={password}
              onChange={setPassword}
              required
            />}
            {mode === "signup" && <Field label={t("login.companyCode")} type="text" value={inviteCode} onChange={setInviteCode} required />}

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
              className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-[var(--brand-ink)] transition hover:brightness-95 disabled:opacity-50"
            >
              {busy
                ? t("common.loading")
                : mode === "signin"
                  ? t("login.signInButton")
                  : mode === "reset" ? t("login.sendLink") : t("login.signUpButton")}
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
            {mode === "signin" ? t("login.registrationSwitch") : t("login.backToLogin")}
          </button>
          {mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setError(""); setInfo(""); }} className="mt-3 w-full text-center text-sm text-[var(--brand)] hover:underline">{t("login.forgotPassword")}</button>}
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
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[#d9fa84]/10"
      />
    </label>
  );
}
