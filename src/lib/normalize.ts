import type { Conversation, LastMessage, Message, User } from "./types";

/**
 * The socket and REST disagree about how a message looks:
 *
 *   REST    { _id: "6a88…", createdAt: "2026-08-21T16:39:28.450Z" }
 *   socket  {  id: "6a88…", createdAt: 1787372176200 }
 *
 * Everything above this function works with the REST shape, so inbound socket
 * payloads are converted here and nowhere else.
 */
export function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;

  const id = m._id ?? m.id;
  const conversation = m.conversation ?? m.conversationId;
  if (typeof id !== "string" || typeof conversation !== "string") return null;

  const sender =
    typeof m.sender === "string"
      ? m.sender
      : // defensive: the API has never populated this, but a future change might
        (m.sender as { _id?: string } | undefined)?._id;
  if (typeof sender !== "string") return null;

  return {
    _id: id,
    conversation,
    sender,
    text: typeof m.text === "string" ? m.text : "",
    createdAt: toIso(m.createdAt),
  };
}

/** Accepts an ISO string (REST) or epoch milliseconds (socket). */
export function toIso(value: unknown): string {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

const asUser = (raw: unknown): User | null => {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (typeof u._id !== "string") return null;
  return {
    _id: u._id,
    name: typeof u.name === "string" && u.name.trim() ? u.name : "Unknown",
    phone: typeof u.phone === "string" ? u.phone : "",
  };
};

/**
 * `lastMessage` is `{}` — not `null` — for a conversation with no messages,
 * so an `if (lastMessage)` check is always true. Collapse it to null here.
 */
const asLastMessage = (raw: unknown): LastMessage => {
  if (!raw || typeof raw !== "object") return {};
  const l = raw as Record<string, unknown>;
  if (typeof l.text !== "string" || typeof l.sender !== "string") return {};
  return { text: l.text, sender: l.sender, createdAt: toIso(l.createdAt) };
};

export const hasLastMessage = (
  l: LastMessage,
): l is { text: string; sender: string; createdAt: string } => "text" in l;

export function normalizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c._id !== "string") return null;

  const lastMessage = asLastMessage(c.lastMessage);
  const updatedAt = toIso(c.updatedAt);

  if (c.type === "group") {
    const participants = Array.isArray(c.participants)
      ? c.participants.map(asUser).filter((u): u is User => u !== null)
      : [];
    return {
      _id: c._id,
      type: "group",
      participants,
      name:
        typeof c.name === "string" && c.name.trim() ? c.name : "Unnamed group",
      createdBy: typeof c.createdBy === "string" ? c.createdBy : "",
      admins: Array.isArray(c.admins)
        ? c.admins.filter((a): a is string => typeof a === "string")
        : [],
      lastMessage,
      updatedAt,
    };
  }

  const participant = asUser(c.participant);
  if (!participant) return null;
  return { _id: c._id, type: "direct", participant, lastMessage, updatedAt };
}
