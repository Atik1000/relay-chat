"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SessionProvider, useSession } from "@/lib/session";
import { RealtimeProvider, useRealtime } from "@/lib/realtime";
import { useConversations } from "@/lib/useConversations";
import { useMessages } from "@/lib/useMessages";
import type { Conversation } from "@/lib/types";
import { isGroup } from "@/lib/types";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { ConnectionPill, ConversationList, GroupIcon } from "@/components/chat/ConversationList";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { GroupPanel } from "@/components/chat/GroupPanel";

function Workspace() {
  const { session, signOut, identityDrift, dismissDrift } = useSession();
  const token = session!.token;
  const me = session!.user;

  const { state } = useRealtime();
  const { conversations, loading, error, refresh, upsert, noteLocalMessage } =
    useConversations(token);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  /** Mobile is one pane at a time; desktop shows both. */
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");

  const active = useMemo(
    () => conversations.find((c) => c._id === activeId) ?? null,
    [conversations, activeId],
  );

  // If the open conversation disappears (an admin removed us, or we left from
  // another tab), fall back cleanly rather than showing an empty thread.
  useEffect(() => {
    if (activeId && !loading && !active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to server state that removed the current selection
      setActiveId(null);
      setShowGroup(false);
      setMobilePane("list");
    }
  }, [activeId, active, loading]);

  const messages = useMessages(token, activeId, me._id);

  const openConversation = useCallback((id: string) => {
    setActiveId(id);
    setMobilePane("thread");
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeId) return;
      noteLocalMessage(activeId, text.trim(), me._id);
      await messages.send(text);
    },
    [activeId, me._id, messages, noteLocalMessage],
  );

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      {identityDrift && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-xs text-amber-100">
          <p>
            Your display name is now <strong>{identityDrift.to}</strong> — someone
            signed in with your number as <strong>{identityDrift.from}</strong>.
            This demo API updates an account&apos;s name on every login.
          </p>
          <button
            onClick={dismissDrift}
            className="shrink-0 rounded px-2 py-0.5 font-semibold transition hover:bg-amber-500/20"
          >
            Got it
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside
          className={`w-full shrink-0 flex-col border-r border-line bg-surface sm:flex sm:w-80 ${
            mobilePane === "list" ? "flex" : "hidden"
          }`}
        >
          <header className="flex items-center justify-between gap-2 px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                  <path d="M3 6.5C3 4.6 4.6 3 6.5 3h3a3.5 3.5 0 0 1 0 7H7l-3 2.5v-2.7A3.5 3.5 0 0 1 3 6.5Z" fill="currentColor" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight">Relay</span>
            </Link>
            <ConnectionPill state={state} />
          </header>

          <div className="px-3 pb-3">
            <button
              onClick={() => setShowNewChat(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              New conversation
            </button>
          </div>

          <ConversationList
            conversations={conversations}
            activeId={activeId}
            meId={me._id}
            loading={loading}
            error={error}
            onSelect={openConversation}
            onRetry={() => void refresh()}
          />

          <footer className="flex items-center gap-2.5 border-t border-line px-3 py-3">
            <Avatar id={me._id} name={me.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-ink">{me.name}</span>
              <span className="block truncate font-mono text-[10px] text-ink-faint">{me.phone}</span>
            </span>
            <button
              onClick={signOut}
              className="rounded-lg px-2 py-1 text-[11px] text-ink-faint transition hover:bg-surface-2 hover:text-ink"
            >
              Sign out
            </button>
          </footer>
        </aside>

        {/* ── Thread ──────────────────────────────────────────────── */}
        <main
          className={`min-w-0 flex-1 flex-col ${
            mobilePane === "thread" ? "flex" : "hidden sm:flex"
          }`}
        >
          {!active ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState
                title="Pick a conversation"
                body="Choose a chat from the list, or start a new one to begin."
                action={
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="mt-1 rounded-xl bg-surface-2 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-line"
                  >
                    New conversation
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <ThreadHeader
                conversation={active}
                meId={me._id}
                onBack={() => setMobilePane("list")}
                onOpenGroup={() => setShowGroup(true)}
              />
              <MessageList
                conversation={active}
                messages={messages.messages}
                meId={me._id}
                loading={messages.loading}
                error={messages.error}
                hasMore={messages.hasMore}
                loadingMore={messages.loadingMore}
                onLoadOlder={messages.loadOlder}
                onRetry={messages.retry}
                onReload={messages.reload}
              />
              <Composer
                onSend={handleSend}
                disabled={messages.loading || Boolean(messages.error)}
                placeholder={
                  isGroup(active)
                    ? `Message ${active.name}`
                    : `Message ${active.participant.name}`
                }
              />
            </>
          )}
        </main>
      </div>

      {showNewChat && (
        <NewChatDialog
          token={token}
          meId={me._id}
          onClose={() => setShowNewChat(false)}
          onStarted={async (id, created) => {
            setShowNewChat(false);
            // A direct conversation comes back as `{ _id }` only, so the list has
            // to be refetched before the thread can render. Select *after* the
            // refetch lands, or the "conversation disappeared" guard below sees
            // an id that is not in the list yet and immediately clears it.
            if (created) upsert(created);
            else await refresh();
            openConversation(id);
            if (created) await refresh();
          }}
        />
      )}

      {showGroup && active && isGroup(active) && (
        <GroupPanel
          token={token}
          group={active}
          meId={me._id}
          onClose={() => setShowGroup(false)}
          onUpdated={(c) => upsert(c)}
          onLeft={async () => {
            setShowGroup(false);
            setActiveId(null);
            setMobilePane("list");
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ThreadHeader({
  conversation, meId, onBack, onOpenGroup,
}: {
  conversation: Conversation;
  meId: string;
  onBack: () => void;
  onOpenGroup: () => void;
}) {
  const group = isGroup(conversation);
  const others = group
    ? conversation.participants.filter((p) => p._id !== meId)
    : [];

  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-3 sm:px-4">
      <button
        onClick={onBack}
        aria-label="Back to conversations"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-2 sm:hidden"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {group ? (
        <AvatarStack people={others} />
      ) : (
        <Avatar id={conversation.participant._id} name={conversation.participant.name} />
      )}

      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
          {group && <GroupIcon className="size-3.5 shrink-0 text-ink-faint" />}
          {group ? conversation.name : conversation.participant.name}
        </h1>
        <p className="truncate text-[11px] text-ink-faint">
          {group
            ? `${conversation.participants.length} members`
            : conversation.participant.phone}
        </p>
      </div>

      {group && (
        <button
          onClick={onOpenGroup}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          Details
        </button>
      )}
    </header>
  );
}

/** Auth gate — everything below it can assume a session exists. */
function Gate() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-faint">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <RealtimeProvider token={session.token}>
      <Workspace />
    </RealtimeProvider>
  );
}

export default function ChatPage() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
