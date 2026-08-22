"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { SessionProvider, useSession } from "@/lib/session";
import { Spinner } from "@/components/ui/Feedback";

function LoginForm() {
  const router = useRouter();
  const { session, loading: restoring, signIn } = useSession();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Already signed in — skip the form entirely.
  useEffect(() => {
    if (!restoring && session) router.replace("/chat");
  }, [restoring, session, router]);

  const phoneOk = phone.trim().length >= 6;
  const nameOk = name.trim().length >= 2;
  const canSubmit = phoneOk && nameOk && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      signIn(await api.login(phone.trim(), name.trim()));
      router.replace("/chat");
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setFieldErrors(
          Object.fromEntries(err.details.map((d) => [d.path, d.message])),
        );
      }
      setError(err instanceof ApiError ? err.userMessage : "Couldn't sign you in.");
      setSubmitting(false);
    }
  }

  if (restoring || session) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-faint">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      {/* Ambient wash — purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
      />
      <div className="relative w-full max-w-sm animate-rise">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight text-ink-muted transition hover:text-ink"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">
            <RelayGlyph />
          </span>
          Relay
        </Link>

        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Sign in to Relay
        </h1>
        <p className="mt-2 text-center text-sm text-ink-faint">
          Enter your number and the name you want others to see. No password, no
          separate signup — a new number creates an account.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <Field
            id="phone"
            label="Phone number"
            value={phone}
            onChange={setPhone}
            placeholder="+15551234567"
            type="tel"
            autoComplete="tel"
            error={fieldErrors.phone}
            hint={phone.length > 0 && !phoneOk ? "That looks a little short." : undefined}
          />
          <Field
            id="name"
            label="Display name"
            value={name}
            onChange={setName}
            placeholder="Ada Lovelace"
            autoComplete="name"
            error={fieldErrors.name}
            hint={name.length > 0 && !nameOk ? "Use at least two characters." : undefined}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Spinner />}
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>

        {/*
          The API upserts on phone number and overwrites the stored name, and the
          demo database is shared. Saying so up front is kinder than letting
          someone wonder why their name changed.
        */}
        <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
          Signing in with a number that already exists will update that
          account&apos;s display name.
        </p>
      </div>
    </main>
  );
}

function Field({
  id, label, value, onChange, placeholder, type = "text", autoComplete, error, hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
}) {
  const help = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={help ? `${id}-help` : undefined}
        className={`w-full rounded-xl border bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint/60 transition focus:border-brand focus:outline-none ${
          error ? "border-rose-500/60" : "border-line"
        }`}
      />
      {help && (
        <p
          id={`${id}-help`}
          className={`mt-1.5 text-xs ${error ? "text-rose-300" : "text-ink-faint"}`}
        >
          {help}
        </p>
      )}
    </div>
  );
}

function RelayGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M3 6.5C3 4.6 4.6 3 6.5 3h3a3.5 3.5 0 0 1 0 7H7l-3 2.5v-2.7A3.5 3.5 0 0 1 3 6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginForm />
    </SessionProvider>
  );
}
