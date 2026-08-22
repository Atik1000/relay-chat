import type { Conversation, Message, Session, User } from "./types";
import { normalizeConversation, normalizeMessage } from "./normalize";

const DEFAULT_API_ORIGIN = "https://frontend-task-chatapp.onrender.com";

/**
 * Origin of the chat API — REST lives at `<origin>/api`, the socket at the root.
 *
 * The env var must be referenced as a complete `process.env.NEXT_PUBLIC_*`
 * expression for Next to inline it at build time.
 *
 * Falls back when the variable is missing *or blank*. `??` alone is not enough:
 * an env var that exists but is empty (easy to do in a hosting dashboard) would
 * make this an empty string, collapsing the base URL to a relative `/api` and
 * silently sending every request to whatever host the app is served from
 * instead of to the chat server. Any trailing slash is stripped so a pasted
 * `https://host/` cannot produce `https://host//api`.
 */
export const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_ORIGIN?.trim() || DEFAULT_API_ORIGIN
).replace(/\/+$/, "");

const BASE = `${API_ORIGIN}/api`;

/** A server error with its machine-readable code preserved for the UI. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The token is gone or expired — the session must be torn down. */
  get isAuthFailure() {
    return this.code === "INVALID_TOKEN" || this.code === "NO_TOKEN";
  }

  /**
   * A message the user can act on. The API leaks raw Mongoose text on 500
   * ("Cast to ObjectId failed for value …"), which is meaningless to a user.
   */
  get userMessage() {
    if (this.code === "SERVER_ERROR" || this.status >= 500)
      return "Something went wrong on the server. Please try again.";
    if (this.status === 0)
      return "Can't reach the server. Check your connection and try again.";
    if (this.details?.length) return this.details[0].message;
    return this.message;
  }
}

let onAuthFailure: (() => void) | null = null;
/** Lets the session layer tear itself down when any request 401s. */
export function setAuthFailureHandler(fn: (() => void) | null) {
  onAuthFailure = fn;
}

type Options = {
  method?: string;
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", token, body, signal } = opts;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const err = (payload as { error?: Record<string, unknown> })?.error;
    const apiError = new ApiError(
      typeof err?.message === "string" ? err.message : `Request failed (${res.status})`,
      res.status,
      typeof err?.code === "string" ? err.code : "UNKNOWN",
      Array.isArray(err?.details)
        ? (err.details as { path: string; message: string }[])
        : undefined,
    );
    if (apiError.isAuthFailure) onAuthFailure?.();
    throw apiError;
  }

  return payload as T;
}

/**
 * `q` is interpolated into a MongoDB `$regex` without escaping, so any regex
 * metacharacter is executed and an unbalanced one crashes the endpoint with a
 * 500. A leading `+` — i.e. every international phone number — is the common
 * case, so escaping here is what makes search-by-phone work at all.
 */
export function escapeForRegexSearch(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `limit` is parseInt'd server-side and any non-positive value silently returns
 * the *entire* history. Clamp so a bad value can never become an accidental
 * full-table read.
 */
const clampLimit = (n: number) => Math.min(Math.max(Math.trunc(n) || 1, 1), 100);

export const api = {
  login: (phone: string, name: string) =>
    request<Session>("/auth/login", { method: "POST", body: { phone, name } }),

  /** Returns a bare user — note this is a different shape from login's `{ token, user }`. */
  me: (token: string, signal?: AbortSignal) =>
    request<User>("/auth/me", { token, signal }),

  async searchUsers(token: string, q: string, signal?: AbortSignal) {
    const raw = await request<unknown>(
      `/users/search?q=${encodeURIComponent(escapeForRegexSearch(q))}`,
      { token, signal },
    );
    return Array.isArray(raw) ? (raw as User[]) : [];
  },

  async conversations(token: string, signal?: AbortSignal) {
    const raw = await request<{ data?: unknown[] }>("/conversations", { token, signal });
    return (raw?.data ?? [])
      .map(normalizeConversation)
      .filter((c): c is Conversation => c !== null);
  },

  /**
   * Returns only `{ _id }` worth trusting: the response is a reduced shape with no
   * `type` and id-strings for participants, so callers refetch the list afterwards.
   */
  startDirect: (token: string, userId: string) =>
    request<{ _id: string }>("/conversations", {
      method: "POST",
      token,
      body: { userId },
    }),

  createGroup: async (token: string, name: string, participantIds: string[]) => {
    const raw = await request<unknown>("/conversations/group", {
      method: "POST",
      token,
      body: { name, participantIds: [...new Set(participantIds)] },
    });
    return normalizeConversation(raw);
  },

  /**
   * `before` is an *inclusive* cursor: the cursor message comes back as the first
   * item of the next page. Callers must de-duplicate by `_id` when merging.
   * Returned newest-first.
   */
  async history(
    token: string,
    conversationId: string,
    { limit = 30, before }: { limit?: number; before?: string } = {},
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ limit: String(clampLimit(limit)) });
    if (before) params.set("before", before);
    const raw = await request<{ messages?: unknown[]; hasMore?: boolean }>(
      `/conversations/${conversationId}/messages?${params}`,
      { token, signal },
    );
    return {
      messages: (raw?.messages ?? [])
        .map(normalizeMessage)
        .filter((m): m is Message => m !== null),
      hasMore: Boolean(raw?.hasMore),
    };
  },

  /**
   * Sending to a conversation that does not exist returns `200` with a body of
   * literal `null`, so a successful status is not enough — the body is checked.
   */
  async sendMessage(token: string, conversationId: string, text: string) {
    const raw = await request<unknown>("/messages", {
      method: "POST",
      token,
      body: { conversationId, text },
    });
    const message = normalizeMessage(raw);
    if (!message)
      throw new ApiError(
        "This conversation no longer exists.",
        404,
        "GHOST_CONVERSATION",
      );
    return message;
  },

  renameGroup: async (token: string, id: string, name: string) =>
    normalizeConversation(
      await request<unknown>(`/conversations/${id}`, {
        method: "PATCH",
        token,
        body: { name },
      }),
    ),

  addParticipants: async (token: string, id: string, userIds: string[]) =>
    normalizeConversation(
      await request<unknown>(`/conversations/${id}/participants`, {
        method: "POST",
        token,
        body: { userIds },
      }),
    ),

  promoteAdmin: async (token: string, id: string, userId: string) =>
    normalizeConversation(
      await request<unknown>(`/conversations/${id}/admins`, {
        method: "POST",
        token,
        body: { userId },
      }),
    ),

  removeParticipant: async (token: string, id: string, userId: string) =>
    normalizeConversation(
      await request<unknown>(`/conversations/${id}/participants/${userId}`, {
        method: "DELETE",
        token,
      }),
    ),
};
