"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { useRealtime } from "./realtime";
import type { Conversation } from "./types";

export function useConversations(token: string) {
  const { subscribe, onConversationChange, connectionEpoch } = useRealtime();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setConversations(await api.conversations(token));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.userMessage : "Couldn't load your chats.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [token]);

  // Refetch on mount and after every reconnect — a group could have changed
  // while the socket was down and no event will be replayed for it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `refresh` is async; its setState calls run in a later microtask, not during this effect
    void refresh();
  }, [refresh, connectionEpoch]);

  // `conversation:updated` fires for group changes only.
  useEffect(() => onConversationChange(() => void refresh()), [onConversationChange, refresh]);

  /**
   * A message in a conversation we already know about only changes its preview
   * and ordering, so patch locally instead of refetching the whole list. A
   * message for an *unknown* conversation means someone started a chat with us
   * — that one needs a real refetch.
   */
  useEffect(
    () =>
      subscribe((message) => {
        let known = false;
        setConversations((prev) => {
          const next = prev.map((c) => {
            if (c._id !== message.conversation) return c;
            known = true;
            return {
              ...c,
              lastMessage: {
                text: message.text,
                sender: message.sender,
                createdAt: message.createdAt,
              },
              updatedAt: message.createdAt,
            };
          });
          if (!known) return prev;
          return next.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        });
        if (!known) void refresh();
      }),
    [subscribe, refresh],
  );

  /** Reflect our own sent message in the sidebar — the socket won't tell us. */
  const noteLocalMessage = useCallback(
    (conversationId: string, text: string, senderId: string) => {
      const createdAt = new Date().toISOString();
      setConversations((prev) =>
        prev
          .map((c) =>
            c._id === conversationId
              ? { ...c, lastMessage: { text, sender: senderId, createdAt }, updatedAt: createdAt }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      );
    },
    [],
  );

  const upsert = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c._id !== conversation._id);
      return [conversation, ...rest];
    });
  }, []);

  return { conversations, loading, error, refresh, upsert, noteLocalMessage };
}
