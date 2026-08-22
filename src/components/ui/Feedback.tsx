export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
      />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-xs text-sm text-ink-faint">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-5 py-6 text-center"
    >
      <p className="text-sm text-rose-100">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Message-shaped placeholders, so the loading state matches what replaces it. */
export function MessageSkeleton() {
  const rows = [
    { mine: false, w: "w-48" }, { mine: true, w: "w-32" },
    { mine: false, w: "w-64" }, { mine: false, w: "w-40" },
    { mine: true, w: "w-52" },
  ];
  return (
    <div className="space-y-4 px-4 py-6" aria-hidden>
      {rows.map((r, i) => (
        <div key={i} className={`flex ${r.mine ? "justify-end" : "justify-start"}`}>
          <div className={`skeleton h-10 rounded-2xl ${r.w}`} />
        </div>
      ))}
      <span className="sr-only">Loading messages…</span>
    </div>
  );
}
