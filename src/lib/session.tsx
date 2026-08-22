"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, setAuthFailureHandler } from "./api";
import type { Session, User } from "./types";

/** Shared so the landing page can check for a session without mounting the provider. */
export const STORAGE_KEY = "relay.session";

type SessionValue = {
  session: Session | null;
  /** null while we are still reading storage — distinct from "logged out". */
  loading: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  /** Set when this account's name was changed by someone else — see below. */
  identityDrift: { from: string; to: string } | null;
  dismissDrift: () => void;
};

const Ctx = createContext<SessionValue | null>(null);

function read(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (typeof parsed?.token !== "string" || !parsed?.user?._id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [identityDrift, setIdentityDrift] =
    useState<SessionValue["identityDrift"]>(null);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setIdentityDrift(null);
    router.replace("/login");
  }, [router]);

  const signIn = useCallback((next: Session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  useEffect(() => {
    // localStorage is not available during SSR, so the session can only be read
    // after mount. Rendering a loading state until then avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store that does not exist on the server
    setSession(read());
    setLoading(false);
  }, []);

  // Any 401 anywhere in the app tears the session down exactly once.
  useEffect(() => {
    setAuthFailureHandler(() => signOut());
    return () => setAuthFailureHandler(null);
  }, [signOut]);

  /**
   * Login upserts by phone and overwrites the stored name, and this API's
   * database is shared by everyone working against it. So another person
   * logging in with the same number silently renames *your* account underneath
   * you. Revalidate against /auth/me on mount and surface it rather than
   * letting the sidebar quietly disagree with the message bubbles.
   */
  useEffect(() => {
    if (!session) return;
    const ac = new AbortController();
    api
      .me(session.token, ac.signal)
      .then((fresh: User) => {
        if (fresh.name === session.user.name) return;
        setIdentityDrift({ from: session.user.name, to: fresh.name });
        const updated = { token: session.token, user: fresh };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setSession(updated);
      })
      .catch(() => {
        /* offline or expired — the 401 handler already covers expiry */
      });
    return () => ac.abort();
    // Intentionally keyed on the token: this is a per-login check, and
    // depending on `session` would re-run it on every name update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn,
      signOut,
      identityDrift,
      dismissDrift: () => setIdentityDrift(null),
    }),
    [session, loading, signIn, signOut, identityDrift],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Convenience for screens that are already behind the auth gate. */
export function useAuthed() {
  const { session, ...rest } = useSession();
  if (!session) throw new Error("useAuthed used outside an authenticated route");
  return { ...rest, session, token: session.token, me: session.user };
}
