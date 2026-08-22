"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/lib/types";
import { isGroup } from "@/lib/types";
import { hasLastMessage } from "@/lib/normalize";
import { formatRelative } from "@/lib/format";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";

const title = (c: Conversation) =>
  isGroup(c) ? c.name : c.participant.name;

export function ConversationList({
  conversations, activeId, meId, loading, error, onSelect, onRetry,
}: {
  conversations: Conversation[];
  activeId: string | null;
  meId: string;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => title(c).toLowerCase().includes(q));
  }, [conversations, filter]);

  if (loading) {
    return (
      <div className="space-y-1 p-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
            <div className="skeleton size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-2/5 rounded" />
              <div className="skeleton h-2.5 w-3/5 rounded" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading conversations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        body="Start one with anybody by their name or phone number."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2">
        <label htmlFor="filter" className="sr-only">
          Filter conversations
        </label>
        <input
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter chats"
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-faint/70 focus:border-brand focus:outline-none"
        />
      </div>

      <ul className="scroll-slim min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-ink-faint">
            No chats match “{filter}”.
          </li>
        )}
        {shown.map((c) => {
          const active = c._id === activeId;
          const preview = hasLastMessage(c.lastMessage)
            ? c.lastMessage
            : null;
          return (
            <li key={c._id}>
              <button
                onClick={() => onSelect(c._id)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                  active ? "bg-brand-soft/40" : "hover:bg-surface-2"
                }`}
              >
                {isGroup(c) ? (
                  <AvatarStack people={c.participants.filter((p) => p._id !== meId)} />
                ) : (
                  <Avatar id={c.participant._id} name={c.participant.name} />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {title(c)}
                    </span>
                    {preview && (
                      <span className="shrink-0 text-[10px] text-ink-faint">
                        {formatRelative(preview.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {isGroup(c) && (
                      <GroupIcon className="size-3 shrink-0 text-ink-faint" />
                    )}
                    <span className="truncate text-xs text-ink-faint">
                      {preview
                        ? `${preview.sender === meId ? "You: " : ""}${
                            preview.text.trim() || "Empty message"
                          }`
                        : "No messages yet"}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GroupIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11.2" cy="6.4" r="1.7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 12.5c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 9.6c1.8 0 3 1 3 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectionPill({ state }: { state: "connecting" | "online" | "offline" }) {
  const copy = {
    connecting: { label: "Connecting…", dot: "bg-amber-400", text: "text-amber-200" },
    online: { label: "Live", dot: "bg-emerald-400", text: "text-emerald-200" },
    offline: { label: "Reconnecting…", dot: "bg-rose-400", text: "text-rose-200" },
  }[state];

  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] font-medium ${copy.text}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-1.5">
        {state !== "online" && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full ${copy.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex size-1.5 rounded-full ${copy.dot}`} />
      </span>
      {copy.label}
      {state === "connecting" && <Spinner className="size-2.5" />}
    </span>
  );
}
