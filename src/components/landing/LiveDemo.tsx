"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Line = { from: "them" | "me"; text: string; delay: number };

/**
 * A scripted replay of a real conversation, running the same visual language as
 * the app itself. It is a self-contained illustration — no API, no auth — so the
 * landing page stays instant and works before anyone signs in.
 */
const SCRIPT: Line[] = [
  { from: "them", text: "did the deploy go out?", delay: 700 },
  { from: "me", text: "just now — staging first", delay: 1200 },
  { from: "them", text: "nice. any errors in the logs?", delay: 1400 },
  { from: "me", text: "clean so far 👀", delay: 1200 },
  { from: "them", text: "shipping it 🚀", delay: 1300 },
];

export function LiveDemo() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState<"them" | "me" | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // Reduced motion: show the finished conversation, skip the performance.
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to a media query, which is a browser-only external store
      setVisible(SCRIPT.length);
      setTyping(null);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function play(index: number) {
      if (cancelled) return;
      if (index >= SCRIPT.length) {
        // Loop the reel so the hero is never static for long.
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setVisible(0);
            play(0);
          }, 3600),
        );
        return;
      }

      const line = SCRIPT[index];
      setTyping(line.from);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setTyping(null);
          setVisible(index + 1);
          play(index + 1);
        }, line.delay),
      );
    }

    play(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [visible, typing, reduced]);

  const shown = useMemo(() => SCRIPT.slice(0, visible), [visible]);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
          PK
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Priya Kapoor</p>
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Live
          </p>
        </div>
      </div>

      <div
        ref={scroller}
        className="scroll-slim h-72 space-y-2 overflow-y-auto px-4 py-4"
        aria-label="Example conversation"
      >
        {shown.map((line, i) => (
          <div
            key={i}
            className={`flex ${line.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[80%] animate-pop rounded-2xl px-3.5 py-2 text-sm ${
                line.from === "me"
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-ink"
              }`}
            >
              {line.text}
            </p>
          </div>
        ))}

        {typing && (
          <div className={`flex ${typing === "me" ? "justify-end" : "justify-start"}`}>
            <span
              className={`flex gap-1 rounded-2xl px-3.5 py-3 ${
                typing === "me" ? "bg-brand/60" : "bg-surface-2"
              }`}
              aria-label="typing"
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-current opacity-60"
                  style={{ animationDelay: `${d * 120}ms` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
          <span className="flex-1 text-sm text-ink-faint/70">Write a message…</span>
          <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-ink-faint">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden>
              <path d="M3.4 10 16.6 3.4 12.6 16.6l-2.6-4.9L3.4 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia is unavailable during SSR, so the initial value can only be read after mount
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
