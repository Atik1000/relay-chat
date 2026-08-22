"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { useRealtime } from "./realtime";
import type { ChatMessage, Message, PendingMessage } from "./types";
import { isPending } from "./types";

const PAGE_SIZE = 30;

/** Oldest → newest, de-duplicated by `_id`, optimistic bubbles kept last. */
function merge(existing: ChatMessage[], incoming: Message[]): ChatMessage[] {
  if (incoming.length === 0) return existing;

  const byId = new Map<string, ChatMessage>();
  const pending: PendingMessage[] = [];

  for (const m of existing) {
    if (isPending(m)) pending.push(m);
    else byId.set(m._id, m);
  }
  // Server copies win over anything already held under the same id.
  for (const m of incoming) byId.set(m._id, m);

  const confirmed = [...byId.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a._id.localeCompare(b._id),
  );
  return [...confirmed, ...pending];
}

export type MessagesState = {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadOlder: () => void;
  send: (text: string) => Promise<void>;
  retry: (clientId: string) => void;
  reload: () => void;
};

export function useMessages(
  token: string,
  conversationId: string | null,
  meId: string,
): MessagesState {
  const { subscribe, connectionEpoch } = useRealtime();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Mirrors `messages` for callbacks that must read the latest list without
  // being re-created on every message. Assigned in an effect, never during
  // render, so concurrent rendering stays safe.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Set by whichever conversation effect is currently live, so a slow response
  // for conversation A cannot land after the user switched to conversation B.
  const runId = useRef(0);

  // The conversation the current `messages` belong to. Used to tell a genuine
  // conversation switch (throw the list away) apart from a reconnect refill of
  // the same conversation (keep it, and reconcile in place).
  const loadedFor = useRef<string | null>(null);

  /** Initial history load, and the reconciliation pass after a reconnect. */
  useEffect(() => {
    if (!conversationId) {
      runId.current += 1;
      loadedFor.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing state when the selection is emptied
      setMessages([]);
      setHasMore(false);
      setError(null);
      return;
    }
    const ac = new AbortController();
    const target = conversationId;
    const run = ++runId.current;
    const isStale = () => runId.current !== run;

    // A different conversation means the list on screen belongs to someone else
    // and must go, or the new thread would open showing the old one's messages.
    // Reloading the *same* conversation (reconnect, retry) keeps what we have so
    // the view does not flash empty.
    const switched = loadedFor.current !== target;
    loadedFor.current = target;
    const cold = switched || messagesRef.current.length === 0;

    if (switched) {
      setMessages([]);
      setHasMore(false);
    }
    if (cold) setLoading(true);
    setError(null);

    api
      .history(token, target, { limit: PAGE_SIZE }, ac.signal)
      .then(({ messages: page, hasMore: more }) => {
        if (isStale()) return;
        // History arrives newest-first; the view wants oldest-first.
        setMessages((prev) => merge(cold ? [] : prev, [...page].reverse()));
        setHasMore(more);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError" || isStale()) return;
        setError(
          err instanceof ApiError
            ? err.userMessage
            : "Couldn't load this conversation.",
        );
      })
      .finally(() => {
        if (!isStale()) setLoading(false);
      });

    return () => ac.abort();
  }, [token, conversationId, reloadToken, connectionEpoch]);

  /** Live messages from everyone else. The server never echoes our own. */
  useEffect(() => {
    if (!conversationId) return;
    return subscribe((message) => {
      if (message.conversation !== conversationId) return;
      setMessages((prev) => merge(prev, [message]));
    });
  }, [subscribe, conversationId]);

  const loadOlder = useCallback(() => {
    if (!conversationId || loadingMore || !hasMore) return;
    const oldest = messagesRef.current.find((m) => !isPending(m));
    if (!oldest) return;

    setLoadingMore(true);
    const target = conversationId;
    const run = runId.current;
    const isStale = () => runId.current !== run;
    api
      .history(token, target, { limit: PAGE_SIZE, before: oldest._id })
      .then(({ messages: page, hasMore: more }) => {
        if (isStale()) return;
        // `before` is inclusive, so this page repeats `oldest` — merge() drops it
        // by id. Without that de-dupe every page boundary would show a duplicate.
        setMessages((prev) => merge(prev, [...page].reverse()));
        setHasMore(more && page.length > 1);
      })
      .catch(() => {
        /* keep what we have; the user can scroll up again to retry */
      })
      .finally(() => {
        if (!isStale()) setLoadingMore(false);
      });
  }, [token, conversationId, hasMore, loadingMore]);

  const deliver = useCallback(
    async (optimistic: PendingMessage) => {
      const target = optimistic.conversation;
      try {
        const saved = await api.sendMessage(token, target, optimistic.text);
        setMessages((prev) =>
          merge(
            prev.filter((m) => !isPending(m) || m.clientId !== optimistic.clientId),
            [saved],
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            isPending(m) && m.clientId === optimistic.clientId
              ? { ...m, status: "failed" as const }
              : m,
          ),
        );
      }
    },
    [token],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      // The API happily stores "" and "   ". Blocking it is the client's job.
      if (!trimmed || !conversationId) return;

      const optimistic: PendingMessage = {
        _id: `pending:${crypto.randomUUID()}`,
        clientId: crypto.randomUUID(),
        conversation: conversationId,
        sender: meId,
        text: trimmed,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);
      await deliver(optimistic);
    },
    [conversationId, meId, deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const target = messagesRef.current.find(
        (m): m is PendingMessage => isPending(m) && m.clientId === clientId,
      );
      if (!target) return;
      setMessages((prev) =>
        prev.map((m) =>
          isPending(m) && m.clientId === clientId
            ? { ...m, status: "sending" as const }
            : m,
        ),
      );
      void deliver({ ...target, status: "sending" });
    },
    [deliver],
  );

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    loadOlder,
    send,
    retry,
    reload: () => setReloadToken((n) => n + 1),
  };
}
