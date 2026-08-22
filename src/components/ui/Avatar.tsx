import { initialsFor, tintFor } from "@/lib/format";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
} as const;

export function Avatar({
  name,
  id,
  size = "md",
  className = "",
}: {
  name: string;
  id: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white/95 ${tintFor(id)} ${SIZES[size]} ${className}`}
    >
      {initialsFor(name)}
    </span>
  );
}

/** Overlapping cluster for group rows. */
export function AvatarStack({
  people,
}: {
  people: { _id: string; name: string }[];
}) {
  const shown = people.slice(0, 3);
  return (
    <span className="flex shrink-0 -space-x-3">
      {shown.map((p) => (
        <Avatar
          key={p._id}
          id={p._id}
          name={p.name}
          size="sm"
          className="ring-2 ring-surface"
        />
      ))}
      {people.length > shown.length && (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-muted ring-2 ring-surface">
          +{people.length - shown.length}
        </span>
      )}
    </span>
  );
}
