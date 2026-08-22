"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Conversation, User } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { useUserSearch } from "@/lib/useUserSearch";

type Mode = "direct" | "group";

export function NewChatDialog({
  token, meId, onClose, onStarted,
}: {
  token: string;
  meId: string;
  onClose: () => void;
  onStarted: (conversationId: string, created?: Conversation) => void;
}) {
  const [mode, setMode] = useState<Mode>("direct");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { results, searching, searchError } = useUserSearch(token, query, meId);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const toggle = (user: User) => {
    setError(null);
    if (mode === "direct") {
      void startDirect(user);
      return;
    }
    setSelected((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user],
    );
  };

  async function startDirect(user: User) {
    setBusy(true);
    setError(null);
    try {
      const { _id } = await api.startDirect(token, user._id);
      // The create response is a reduced shape with no `type`, so the caller
      // refetches the list rather than trying to render this directly.
      onStarted(_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Couldn't start that chat.");
      setBusy(false);
    }
  }

  async function createGroup() {
    // The API needs 3+ members total (you + 2), and rejects an empty name.
    if (selected.length < 2 || !groupName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createGroup(
        token,
        groupName.trim(),
        selected.map((u) => u._id),
      );
      if (created) onStarted(created._id, created);
      else onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Couldn't create the group.");
      setBusy(false);
    }
  }

  const groupReady = selected.length >= 2 && groupName.trim().length > 0;

  return (
    <Modal onClose={onClose} title="New conversation" labelledBy="new-chat-title">
      <div className="flex gap-1 rounded-xl bg-canvas p-1" role="tablist">
        {(["direct", "group"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setSelected([]);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              mode === m ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "direct" ? "Direct message" : "Group"}
          </button>
        ))}
      </div>

      {mode === "group" && (
        <div className="mt-4">
          <label htmlFor="group-name" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Group name
          </label>
          <input
            id="group-name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Design team"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="user-search" className="mb-1.5 block text-xs font-medium text-ink-muted">
          {mode === "direct" ? "Find someone" : "Add people"}
        </label>
        <div className="relative">
          <input
            id="user-search"
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone number"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 pr-9 text-sm focus:border-brand focus:outline-none"
          />
          {searching && (
            <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          )}
        </div>
      </div>

      {mode === "group" && selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <li key={u._id}>
              <button
                onClick={() => toggle(u)}
                className="flex items-center gap-1.5 rounded-full bg-brand-soft/50 py-1 pl-1 pr-2.5 text-xs text-ink transition hover:bg-brand-soft/70"
              >
                <Avatar id={u._id} name={u.name} size="sm" className="!size-5 !text-[9px]" />
                {u.name}
                <span aria-label={`Remove ${u.name}`}>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="scroll-slim mt-3 max-h-64 min-h-[8rem] overflow-y-auto rounded-xl border border-line bg-canvas">
        {searchError ? (
          <p className="p-4 text-center text-xs text-rose-300">{searchError}</p>
        ) : query.trim().length === 0 ? (
          <EmptyState
            title="Search for someone"
            body="Type a name or a phone number — including the leading +."
          />
        ) : results.length === 0 && !searching ? (
          <EmptyState
            title="Nobody found"
            body={`No account matches “${query.trim()}”.`}
          />
        ) : (
          <ul className="p-1.5">
            {results.map((u) => {
              const picked = selected.some((s) => s._id === u._id);
              return (
                <li key={u._id}>
                  <button
                    onClick={() => toggle(u)}
                    disabled={busy}
                    aria-pressed={mode === "group" ? picked : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition disabled:opacity-50 ${
                      picked ? "bg-brand-soft/40" : "hover:bg-surface-2"
                    }`}
                  >
                    <Avatar id={u._id} name={u.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{u.name}</span>
                      <span className="block truncate font-mono text-[11px] text-ink-faint">
                        {u.phone}
                      </span>
                    </span>
                    {mode === "group" && picked && <CheckMark />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {mode === "group" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-faint">
            {selected.length < 2
              ? `Pick ${2 - selected.length} more — a group needs at least three people.`
              : `${selected.length + 1} members, including you.`}
          </p>
          <button
            onClick={createGroup}
            disabled={!groupReady || busy}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Spinner className="size-3" />}
            Create group
          </button>
        </div>
      )}
    </Modal>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-brand" fill="none" aria-hidden>
      <path d="M3 8.5 6 11.5 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
