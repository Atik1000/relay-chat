"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/session";

/**
 * Whether a session is stored, for the landing page's call-to-action copy.
 *
 * Reads localStorage directly rather than mounting the full session provider —
 * the page only needs to pick between two labels, not manage auth.
 *
 * Starts `false` so the server render and the first client render agree; the
 * real value lands after mount. Signed-out is the right default for a public
 * marketing page, so the pre-hydration frame is never misleading.
 */
function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store that does not exist during SSR
      setSignedIn(Boolean(raw && JSON.parse(raw)?.token));
    } catch {
      setSignedIn(false);
    }
  }, []);

  return signedIn;
}

/**
 * The landing page is a deliverable in its own right, so a signed-in visitor is
 * never redirected away from it — the copy just stops pretending they are a
 * stranger, and links straight to the app instead of bouncing through /login.
 */
export function HeaderCta() {
  const signedIn = useSignedIn();
  return (
    <Link
      href={signedIn ? "/chat" : "/login"}
      className="rounded-lg bg-surface-2 px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-line"
    >
      {signedIn ? "Go to your chats" : "Open app"}
    </Link>
  );
}

export function HeroCta() {
  const signedIn = useSignedIn();
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={signedIn ? "/chat" : "/login"}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {signedIn ? "Go to your chats" : "Open Relay"}
        </Link>
        <a
          href="#scroll-lab"
          className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-ink-muted transition hover:bg-surface hover:text-ink"
        >
          Try the scroll demo
        </a>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        {signedIn
          ? "You're already signed in — pick up where you left off."
          : "Sign in with any phone number and a display name — a new number creates an account."}
      </p>
    </>
  );
}

export function ClosingCta() {
  const signedIn = useSignedIn();
  return (
    <>
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {signedIn ? "Pick up where you left off" : "Start a conversation"}
      </h2>
      <p className="mt-4 text-pretty text-ink-muted">
        {signedIn
          ? "Your conversations are waiting."
          : "No password and no signup form. Enter a phone number and the name you want people to see."}
      </p>
      <Link
        href={signedIn ? "/chat" : "/login"}
        className="mt-8 inline-block rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        {signedIn ? "Go to your chats" : "Open Relay"}
      </Link>
    </>
  );
}
