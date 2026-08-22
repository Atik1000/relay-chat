"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MAX_ROWS_PX = 160;

export function Composer({
  onSend,
  disabled,
  placeholder = "Write a message…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  // The API accepts "" and "   " — this is the only thing stopping an empty send.
  const canSend = text.trim().length > 0 && !disabled;

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [text]);

  function submit() {
    if (!canSend) return;
    onSend(text);
    setText("");
    // Keep focus so a conversation can be typed without touching the mouse.
    requestAnimationFrame(() => area.current?.focus());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-line bg-surface/60 px-3 py-3 backdrop-blur sm:px-4"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-canvas px-3 py-2 transition focus-within:border-brand">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline. IME composition must not
            // be interrupted, or the first Enter of a CJK candidate selection
            // would send a half-finished word.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="scroll-slim max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-faint/70 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
            <path
              d="M3.4 10 16.6 3.4 12.6 16.6l-2.6-4.9L3.4 10Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-ink-faint/70">
        <kbd className="font-sans">Enter</kbd> to send ·{" "}
        <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for a new line
      </p>
    </form>
  );
}
