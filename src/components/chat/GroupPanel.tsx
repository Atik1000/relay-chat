"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Conversation, GroupConversation, User } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Feedback";
import { useUserSearch } from "@/lib/useUserSearch";

export function GroupPanel({
  token, group, meId, onClose, onUpdated, onLeft,
}: {
  token: string;
  group: GroupConversation;
  meId: string;
  onClose: () => void;
  onUpdated: (c: Conversation) => void;
  onLeft: () => void;
}) {
  const iAmAdmin = group.admins.includes(meId);

  const [name, setName] = useState(group.name);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set(group.participants.map((p) => p._id));
  const { results, searching } = useUserSearch(token, query, meId);
  const candidates = results.filter((u) => !memberIds.has(u._id));

  /** Every group mutation returns the full updated conversation. */
  async function run(key: string, fn: () => Promise<Conversation | null>) {
    setBusy(key);
    setError(null);
    try {
      const updated = await fn();
      if (updated) onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  const renameDirty = name.trim() !== group.name && name.trim().length > 0;

  return (
    <Modal onClose={onClose} title="Group details" labelledBy="group-title">
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <section>
        <label htmlFor="group-rename" className="mb-1.5 block text-xs font-medium text-ink-muted">
          Name
        </label>
        <div className="flex gap-2">
          <input
            id="group-rename"
            value={name}
            disabled={!iAmAdmin}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-canvas px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:opacity-60"
          />
          {iAmAdmin && (
            <button
              onClick={() => run("rename", () => api.renameGroup(token, group._id, name.trim()))}
              disabled={!renameDirty || busy === "rename"}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === "rename" && <Spinner className="size-3" />}
              Save
            </button>
          )}
        </div>
        {!iAmAdmin && (
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Only admins can rename this group.
          </p>
        )}
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-medium text-ink-muted">
          {group.participants.length} member{group.participants.length === 1 ? "" : "s"}
        </h3>
        <ul className="scroll-slim max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-canvas p-1.5">
          {group.participants.map((p) => (
            <MemberRow
              key={p._id}
              user={p}
              isMe={p._id === meId}
              isAdmin={group.admins.includes(p._id)}
              canManage={iAmAdmin}
              busy={busy}
              onPromote={() => run(`promote:${p._id}`, () => api.promoteAdmin(token, group._id, p._id))}
              onRemove={() =>
                run(`remove:${p._id}`, async () => {
                  const updated = await api.removeParticipant(token, group._id, p._id);
                  if (p._id === meId) {
                    onLeft();
                    return null;
                  }
                  return updated;
                })
              }
            />
          ))}
        </ul>
        {/*
          The API enforces "3+ members" only when a group is created — people can
          leave until two remain. Flagging it beats letting it look like a bug.
        */}
        {group.participants.length < 3 && (
          <p className="mt-2 text-[11px] text-amber-200/80">
            This group is below the three-member minimum because people have left.
          </p>
        )}
      </section>

      {iAmAdmin && (
        <section className="mt-5">
          <label htmlFor="add-member" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Add someone
          </label>
          <div className="relative">
            <input
              id="add-member"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone number"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2 pr-9 text-sm focus:border-brand focus:outline-none"
            />
            {searching && (
              <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            )}
          </div>

          {query.trim() && (
            <ul className="scroll-slim mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-canvas p-1.5">
              {candidates.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-ink-faint">
                  {searching ? "Searching…" : "Nobody new matches that."}
                </li>
              ) : (
                candidates.map((u) => (
                  <li key={u._id}>
                    <button
                      onClick={() =>
                        run(`add:${u._id}`, async () => {
                          const updated = await api.addParticipants(token, group._id, [u._id]);
                          setQuery("");
                          return updated;
                        })
                      }
                      disabled={busy !== null}
                      className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-surface-2 disabled:opacity-50"
                    >
                      <Avatar id={u._id} name={u.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{u.name}</span>
                        <span className="block truncate font-mono text-[11px] text-ink-faint">
                          {u.phone}
                        </span>
                      </span>
                      {busy === `add:${u._id}` ? <Spinner className="size-3.5" /> : <span className="text-xs text-brand">Add</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      )}

      <button
        onClick={() => run("leave", async () => {
          await api.removeParticipant(token, group._id, meId);
          onLeft();
          return null;
        })}
        disabled={busy === "leave"}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
      >
        {busy === "leave" && <Spinner className="size-3" />}
        Leave group
      </button>
    </Modal>
  );
}

function MemberRow({
  user, isMe, isAdmin, canManage, busy, onPromote, onRemove,
}: {
  user: User;
  isMe: boolean;
  isAdmin: boolean;
  canManage: boolean;
  busy: string | null;
  onPromote: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg p-2">
      <Avatar id={user._id} name={user.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm text-ink">{user.name}</span>
          {isMe && <span className="text-[10px] text-ink-faint">(you)</span>}
          {isAdmin && (
            <span className="rounded bg-brand-soft/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">
              Admin
            </span>
          )}
        </span>
        <span className="block truncate font-mono text-[11px] text-ink-faint">
          {user.phone}
        </span>
      </span>

      {canManage && !isAdmin && (
        <button
          onClick={onPromote}
          disabled={busy !== null}
          className="rounded-md px-2 py-1 text-[11px] text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          {busy === `promote:${user._id}` ? <Spinner className="size-3" /> : "Make admin"}
        </button>
      )}
      {canManage && !isMe && (
        <button
          onClick={onRemove}
          disabled={busy !== null}
          aria-label={`Remove ${user.name}`}
          className="rounded-md px-2 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-40"
        >
          {busy === `remove:${user._id}` ? <Spinner className="size-3" /> : "Remove"}
        </button>
      )}
    </li>
  );
}
