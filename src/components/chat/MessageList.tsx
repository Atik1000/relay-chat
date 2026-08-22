"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation, User } from "@/lib/types";
import { isGroup, isPending } from "@/lib/types";
import { formatDayLabel, formatTime, sameDay } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorState, MessageSkeleton, Spinner } from "@/components/ui/Feedback";

/** Treat "within 80px of the bottom" as being pinned to the latest message. */
const PIN_THRESHOLD = 80;
/** Load the previous page once the user is this close to the top. */
const TOP_THRESHOLD = 120;

type Props = {
  conversation: Conversation;
  messages: ChatMessage[];
  meId: string;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  onRetry: (clientId: string) => void;
  onReload: () => void;
};

export function MessageList({
  conversation, messages, meId, loading, error,
  hasMore, loadingMore, onLoadOlder, onRetry, onReload,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  /**
   * Whether the view is following the conversation. This is a ref, not state:
   * it is read inside a layout effect that must see the value from *before*
   * the new messages were painted, and it must not itself trigger a render.
   */
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const prevLast = useRef<string | null>(null);
  const prevFirst = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const prevConversation = useRef(conversation._id);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottom.current?.scrollIntoView({ behavior, block: "end" });
    pinned.current = true;
    setShowJump(false);
    setUnseen(0);
  }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance <= PIN_THRESHOLD;
    pinned.current = atBottom;

    if (atBottom) {
      setShowJump(false);
      setUnseen(0);
    } else {
      setShowJump(true);
    }

    if (el.scrollTop <= TOP_THRESHOLD && hasMore && !loadingMore) onLoadOlder();
  }, [hasMore, loadingMore, onLoadOlder]);

  // Jump to the newest message when the conversation changes — without an
  // animation, so switching chats never looks like a scroll.
  useLayoutEffect(() => {
    if (prevConversation.current === conversation._id) return;
    prevConversation.current = conversation._id;
    pinned.current = true;
    setShowJump(false);
    setUnseen(0);
    prevLast.current = null;
    prevFirst.current = null;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [conversation._id, scrollToBottom]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || messages.length === 0) return;

    const first = messages[0];
    const last = messages[messages.length - 1];
    const lastKey = isPending(last) ? last.clientId : last._id;
    const firstKey = isPending(first) ? first.clientId : first._id;

    const prependedOlder =
      prevFirst.current !== null && firstKey !== prevFirst.current;
    const appendedNew = prevLast.current !== null && lastKey !== prevLast.current;
    const isFirstPaint = prevLast.current === null;

    if (isFirstPaint) {
      // Cold load: land on the newest message with no animation.
      el.scrollTop = el.scrollHeight;
    } else if (prependedOlder) {
      // An older page was prepended. Preserve the reading position by pushing
      // the viewport down by exactly the height that was just added — otherwise
      // the content the user is reading jumps off screen.
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    } else if (appendedNew) {
      if (pinned.current) {
        bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        // The user is reading history. Never yank them down — just count what
        // arrived, unless it is their own message, which is always followed.
        const mine = last.sender === meId;
        // Both branches depend on the scroll measurement taken above, which only
        // exists after paint — so this state genuinely cannot be derived.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a post-paint DOM measurement
        if (mine) scrollToBottom("smooth");
        else setUnseen((n) => n + 1);
      }
    }

    prevLast.current = lastKey;
    prevFirst.current = firstKey;
    prevScrollHeight.current = el.scrollHeight;
  }, [messages, meId, scrollToBottom]);

  const people = new Map<string, User>(
    isGroup(conversation)
      ? conversation.participants.map((p) => [p._id, p])
      : [[conversation.participant._id, conversation.participant]],
  );

  if (loading) return <MessageSkeleton />;

  if (error) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <ErrorState message={error} onRetry={onReload} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${isGroup(conversation) ? conversation.name : conversation.participant.name}`}
      >
        {hasMore && (
          <div className="flex justify-center pb-4">
            {loadingMore ? (
              <span className="flex items-center gap-2 text-xs text-ink-faint">
                <Spinner className="size-3" /> Loading earlier messages…
              </span>
            ) : (
              <button
                onClick={onLoadOlder}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition hover:bg-surface-2"
              >
                Load earlier messages
              </button>
            )}
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            body={
              isGroup(conversation)
                ? "Say hello to get the group started."
                : `Send the first message to ${conversation.participant.name}.`
            }
          />
        ) : (
          messages.map((message, i) => {
            const prev = messages[i - 1];
            const mine = message.sender === meId;
            const showDay = !prev || !sameDay(prev.createdAt, message.createdAt);
            // Collapse a run from one person into a single visual block.
            const grouped =
              !showDay &&
              prev?.sender === message.sender &&
              new Date(message.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <
                5 * 60_000;

            return (
              <div key={isPending(message) ? message.clientId : message._id}>
                {showDay && <DaySeparator iso={message.createdAt} />}
                <Bubble
                  message={message}
                  mine={mine}
                  grouped={grouped}
                  sender={people.get(message.sender)}
                  showSender={isGroup(conversation) && !mine && !grouped}
                  onRetry={onRetry}
                />
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {/* Only offered when the user has actually scrolled away. */}
      {showJump && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 animate-pop items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/40 transition hover:brightness-110"
        >
          {unseen > 0
            ? `${unseen} new message${unseen > 1 ? "s" : ""}`
            : "Jump to latest"}
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path d="M8 3v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {formatDayLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Bubble({
  message, mine, grouped, sender, showSender, onRetry,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
  sender?: User;
  showSender: boolean;
  onRetry: (clientId: string) => void;
}) {
  const pending = isPending(message);
  const failed = pending && message.status === "failed";

  return (
    <div
      className={`flex items-end gap-2 ${grouped ? "mt-0.5" : "mt-3"} ${
        mine ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Spacer keeps grouped bubbles aligned under the first one. */}
      <span className="w-8 shrink-0">
        {!mine && !grouped && sender && (
          <Avatar id={sender._id} name={sender.name} size="sm" />
        )}
      </span>

      <div className={`flex max-w-[min(78%,34rem)] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showSender && sender && (
          <span className="mb-1 px-1 text-[11px] font-semibold text-ink-muted">
            {sender.name}
          </span>
        )}

        <div
          className={`group relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            mine
              ? `bg-brand text-white ${grouped ? "rounded-tr-md" : ""}`
              : `bg-surface-2 text-ink ${grouped ? "rounded-tl-md" : ""}`
          } ${failed ? "opacity-70 ring-1 ring-rose-500/60" : ""} ${
            pending && !failed ? "opacity-70" : ""
          }`}
        >
          {/* Rendered as text, never HTML — the API stores input verbatim. */}
          <p className="whitespace-pre-wrap break-words">{message.text}</p>

          <span
            className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
              mine ? "text-white/65" : "text-ink-faint"
            }`}
          >
            <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>
              {formatTime(message.createdAt)}
            </time>
            {pending && !failed && <Spinner className="size-2.5" />}
            {!pending && mine && <CheckIcon />}
          </span>
        </div>

        {failed && (
          <button
            onClick={() => onRetry(message.clientId)}
            className="mt-1 px-1 text-[11px] font-medium text-rose-300 underline underline-offset-2 transition hover:text-rose-200"
          >
            Not delivered — tap to retry
          </button>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-label="Sent">
      <path d="M3 8.5 6 11.5 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
