"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import type { User } from "./types";

const DEBOUNCE_MS = 280;

type Loaded = { query: string; users: User[] };
type Failed = { query: string; message: string };

/**
 * Debounced user search.
 *
 * An empty `q` is never sent: the endpoint treats it as "no filter" and returns
 * every account on the service, which is both a pointless payload and a list no
 * user asked to see.
 *
 * `searching` and `results` are derived from which query the last settled
 * response belongs to, rather than tracked as their own state. That keeps a
 * stale response for "ada" from being shown while "adam" is still in flight,
 * and removes the flicker of clearing results between keystrokes.
 */
export function useUserSearch(token: string, query: string, excludeId?: string) {
  const trimmed = query.trim();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);

  useEffect(() => {
    if (!trimmed) return;

    const ac = new AbortController();
    const timer = setTimeout(() => {
      api
        .searchUsers(token, trimmed, ac.signal)
        .then((users) => setLoaded({ query: trimmed, users }))
        .catch((err: unknown) => {
          if ((err as Error)?.name === "AbortError") return;
          setFailed({
            query: trimmed,
            message: err instanceof ApiError ? err.userMessage : "Search failed.",
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [token, trimmed]);

  const settled = loaded?.query === trimmed || failed?.query === trimmed;

  const results = useMemo(() => {
    if (!trimmed || loaded?.query !== trimmed) return [];
    return excludeId
      ? loaded.users.filter((u) => u._id !== excludeId)
      : loaded.users;
  }, [trimmed, loaded, excludeId]);

  return {
    results,
    searching: trimmed !== "" && !settled,
    searchError: failed?.query === trimmed ? failed.message : null,
  };
}
