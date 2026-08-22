"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Bubble = { id: number; from: "them" | "me"; text: string };

const HISTORY: Bubble[] = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  from: i % 3 === 0 ? "me" : "them",
  text: [
    "let's ship the onboarding flow first",
    "agreed — the empty states need copy though",
    "I'll draft them tonight",
    "what about the group admin rules?",
    "admins only for rename + members",
    "makes sense",
    "any thoughts on pagination?",
  ][i % 7],
}));

const INCOMING = [
  "one more thing —",
  "we should handle reconnects too",
  "otherwise you silently miss messages",
  "good catch, adding it now",
  "👏",
];

/**
 * An interactive comparison of the two possible auto-scroll rules.
 *
 * "Naive" force-scrolls on every new message, which rips the view away from
 * anyone reading history. "Relay" only follows when you are already at the
 * bottom, and otherwise counts what arrived. The point is that the difference
 * is impossible to appreciate from a screenshot, so the page lets you feel it:
 * scroll up, then watch messages land.
 */
export function ScrollLab() {
  const [mode, setMode] = useState<"naive" | "relay">("relay");
  const [bubbles, setBubbles] = useState<Bubble[]>(HISTORY);
  const [unseen, setUnseen] = useState(0);
  const [running, setRunning] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const nextIndex = useRef(0);
  const prevCount = useRef(HISTORY.length);

  const atBottom = () => {
    const el = scroller.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (bubbles.length === prevCount.current) return;
    prevCount.current = bubbles.length;

    // Both branches depend on the scroll position measured above, which only
    // exists after paint — so this state genuinely cannot be derived.
    if (mode === "naive" || pinned.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a post-paint DOM measurement
      if (mode === "naive") setUnseen(0);
    } else {
      setUnseen((n) => n + 1);
    }
  }, [bubbles, mode]);

  // Land at the bottom on first paint.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const text = INCOMING[nextIndex.current % INCOMING.length];
      nextIndex.current += 1;
      setBubbles((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), from: "them", text },
      ]);
    }, 2200);
    return () => clearInterval(timer);
  }, [running]);

  const reset = () => {
    setBubbles(HISTORY);
    setUnseen(0);
    nextIndex.current = 0;
    prevCount.current = HISTORY.length;
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = el.scrollHeight;
      pinned.current = true;
    });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex gap-1 rounded-xl bg-canvas p-1" role="group" aria-label="Scroll behaviour">
          {(
            [
              ["relay", "Relay"],
              ["naive", "Naive"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                setUnseen(0);
              }}
              aria-pressed={mode === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === value ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            {running ? "Pause messages" : "Start messages"}
          </button>
          <button
            onClick={reset}
            className="rounded-lg px-2.5 py-1.5 text-xs text-ink-faint transition hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>

      <p className="border-b border-line bg-canvas/50 px-4 py-2.5 text-xs text-ink-muted">
        {mode === "relay"
          ? "Scroll up, then start the messages. The view stays exactly where you left it and counts what arrived."
          : "Scroll up, then start the messages. Every new message drags you back down mid-sentence."}
      </p>

      <div className="relative">
        <div
          ref={scroller}
          onScroll={() => {
            pinned.current = atBottom();
            if (pinned.current) setUnseen(0);
          }}
          className="scroll-slim h-80 space-y-2 overflow-y-auto px-4 py-4"
        >
          {bubbles.map((b) => (
            <div key={b.id} className={`flex ${b.from === "me" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  b.from === "me" ? "bg-brand text-white" : "bg-surface-2 text-ink"
                }`}
              >
                {b.text}
              </p>
            </div>
          ))}
        </div>

        {mode === "relay" && unseen > 0 && (
          <button
            onClick={() => {
              const el = scroller.current;
              el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              setUnseen(0);
            }}
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 animate-pop items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/40"
          >
            {unseen} new message{unseen > 1 ? "s" : ""}
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
              <path d="M8 3v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
