/** Shapes recovered from the live API — see docs/API.md. */

export type User = {
  _id: string;
  name: string;
  phone: string;
  createdAt?: string;
};

export type Message = {
  _id: string;
  conversation: string;
  sender: string;
  text: string;
  /** Always ISO-8601 here. The socket sends epoch-ms; normalizeMessage converts it. */
  createdAt: string;
};

/**
 * A message that exists only on the client until the server confirms it.
 * The socket never echoes your own messages back, so the POST response is the
 * only confirmation there is — see docs/API.md § "Why this client sends over REST".
 */
export type PendingMessage = Message & {
  status: "sending" | "failed";
  /** Stable key so an optimistic bubble can be swapped for the server's copy. */
  clientId: string;
};

export type ChatMessage = Message | PendingMessage;

export const isPending = (m: ChatMessage): m is PendingMessage =>
  "status" in m;

export type LastMessage =
  | { text: string; sender: string; createdAt: string }
  | Record<string, never>;

/**
 * The API returns two genuinely different shapes under one endpoint, discriminated
 * by `type`. `direct` carries `participant` (singular, the other person);
 * `group` carries `participants` (plural, including you).
 */
export type DirectConversation = {
  _id: string;
  type: "direct";
  participant: User;
  lastMessage: LastMessage;
  updatedAt: string;
};

export type GroupConversation = {
  _id: string;
  type: "group";
  participants: User[];
  name: string;
  createdBy: string;
  admins: string[];
  lastMessage: LastMessage;
  updatedAt: string;
};

export type Conversation = DirectConversation | GroupConversation;

export const isGroup = (c: Conversation): c is GroupConversation =>
  c.type === "group";

export type Session = { token: string; user: User };
