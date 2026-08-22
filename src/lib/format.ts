/** Display helpers. All timestamps arrive as ISO strings (see normalize.ts). */

const time = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const fullDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatTime = (iso: string) => time.format(new Date(iso));

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today" / "Yesterday" / "Tuesday" / "3 March 2026" */
export function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return weekday.format(date);
  return fullDate.format(date);
}

/** Compact stamp for the conversation list. */
export function formatRelative(iso: string) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return time.format(date);
  if (days === 1) return "Yesterday";
  if (days < 7) return weekday.format(date);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const sameDay = (a: string, b: string) =>
  startOfDay(new Date(a)) === startOfDay(new Date(b));

/** Deterministic avatar tint so a person keeps the same colour everywhere. */
const TINTS = [
  "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-fuchsia-500",
];

export function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
