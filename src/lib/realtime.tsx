"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Socket } from "socket.io-client";
import { createSocket, type ConnectionState } from "./socket";
import { normalizeMessage } from "./normalize";
import type { Message } from "./types";

type Listener = (message: Message) => void;

type RealtimeValue = {
  state: ConnectionState;
  /** Bumped on every successful (re)connect, so views can refill missed messages. */
  connectionEpoch: number;
  subscribe: (fn: Listener) => () => void;
  onConversationChange: (fn: () => void) => () => void;
};

const Ctx = createContext<RealtimeValue | null>(null);

export function RealtimeProvider({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  // Listeners live in refs so a re-render never tears down the socket.
  const messageListeners = useRef(new Set<Listener>());
  const conversationListeners = useRef(new Set<() => void>());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setState("online");
      // A reconnect means we were deaf for a while. The server does not replay
      // what we missed, so tell the views to reconcile against REST.
      setConnectionEpoch((n) => n + 1);
    });
    socket.on("disconnect", () => setState("offline"));
    socket.on("connect_error", () => setState("offline"));

    socket.on("message:new", (raw: unknown) => {
      const message = normalizeMessage(raw);
      if (message) messageListeners.current.forEach((fn) => fn(message));
    });

    socket.on("conversation:updated", () => {
      conversationListeners.current.forEach((fn) => fn());
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [token]);

  const value = useMemo<RealtimeValue>(
    () => ({
      state,
      connectionEpoch,
      subscribe(fn) {
        messageListeners.current.add(fn);
        return () => messageListeners.current.delete(fn);
      },
      onConversationChange(fn) {
        conversationListeners.current.add(fn);
        return () => conversationListeners.current.delete(fn);
      },
    }),
    [state, connectionEpoch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return ctx;
}
