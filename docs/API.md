# Chat API — Reference

> Written by hand from the live API. The provided Swagger document is **request-only**: it
> specifies endpoints, methods and request bodies, but explicitly leaves out every response
> body and status code. Everything below the request line was recovered by probing the running
> service (`scripts/probe-api.mjs` reproduces it), so this document is the source of truth the
> client is built against.

**Base URL (REST)** `https://frontend-task-chatapp.onrender.com/api`
**Origin (WebSocket)** `https://frontend-task-chatapp.onrender.com` — the socket lives at the
host **root**, *not* under `/api`.

---

## Conventions

### Authentication
Every endpoint except `POST /auth/login` requires a JWT:

```http
Authorization: Bearer <token>
```

The token is an HS256 JWT with `{ sub: <userId>, iat, exp }` and a **7-day** lifetime.

### Response envelopes
The API uses three different shapes. This is not a mistake in this document — the API really
is inconsistent, and the client normalises it at the edge (see [Quirks](#quirks--deviations)).

| Shape | Used by |
| --- | --- |
| Bare object | `POST /auth/login`, `GET /auth/me`, `POST /messages`, all group endpoints |
| Bare array | `GET /users/search` |
| `{ data: [...] }` | `GET /conversations` |
| `{ messages: [...], hasMore }` | `GET /conversations/{id}/messages` |

### Error shape
Errors are consistent, which is genuinely useful:

```jsonc
{
  "error": {
    "message": "Not a participant of this conversation",
    "code": "FORBIDDEN",
    "details": [                       // only on VALIDATION_ERROR
      { "path": "name", "message": "Required" }
    ]
  }
}
```

Observed codes: `VALIDATION_ERROR` (400), `NO_TOKEN` (**400**, not 401), `INVALID_TOKEN` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `UNKNOWN_USER` (400), `TOO_FEW_MEMBERS` (400),
`NOT_A_MEMBER` (400), `NOT_A_GROUP` (400), `SERVER_ERROR` (500).

`SERVER_ERROR` leaks raw Mongoose text, e.g.
`Cast to ObjectId failed for value "nope" (type string) at path "_id" for model "User"`.

### Entities

```ts
type User = { _id: string; name: string; phone: string; createdAt?: string }

type Message = {
  _id: string            // NOTE: the socket calls this `id`
  conversation: string
  sender: string         // user id, never populated
  text: string
  createdAt: string      // ISO-8601 over REST; epoch-ms NUMBER over the socket
}

type Conversation =
  | { _id; type: "direct"; participant: User;    lastMessage: LastMessage; updatedAt: string }
  | { _id; type: "group";  participants: User[]; lastMessage: LastMessage; updatedAt: string
      name: string; createdBy: string; admins: string[] }

type LastMessage = { text: string; sender: string; createdAt: string } | {}  // `{}`, not null
```

The `direct` variant exposes `participant` (**singular** — the other person, already resolved)
while `group` exposes `participants` (**plural**, including you). A discriminated union on
`type` is the only safe way to read this.

---

## Auth

### `POST /auth/login` — log in or register
No auth. There is no separate signup: an unknown `phone` creates an account, a known one logs in.

```jsonc
// request
{ "phone": "+15551234567", "name": "Ada Lovelace" }
```
```jsonc
// 200
{
  "token": "eyJhbGciOiJIUzI1NiIs…",
  "user": { "_id": "6a8827c4…", "name": "Ada Lovelace",
            "phone": "+15551234567", "createdAt": "2026-08-21T10:26:12.874Z" }
}
```

`400 VALIDATION_ERROR` when `phone` or `name` is missing. **`phone` is not validated at all** —
`"abc"` is accepted and creates a user.

> ⚠️ Logging in with an existing phone **overwrites that account's name** with whatever you
> send. Combined with a database shared by every candidate, accounts get silently renamed by
> other people. This was observed live: a probe user created as `Atik Probe A` came back as
> `Ada Probe` a few hours later.

### `GET /auth/me` — current user
Returns a bare `User` (no `token`, no `user` wrapper — a *different* shape from login).
`400 NO_TOKEN` if the header is absent, `401 INVALID_TOKEN` if it is malformed or expired.

---

## Users

### `GET /users/search?q=` — search by name or phone
Returns a bare `User[]`, matching `name` **or** `phone`, case-insensitive substring. Includes
the caller. No pagination, no sort guarantee.

> ⚠️ `q` is documented as **required** but is optional in practice, and an absent or empty `q`
> **dumps the entire user table** (every name and phone on the service).
>
> ⚠️ `q` is interpolated into a MongoDB `$regex` **unescaped**. Any regex metacharacter is
> executed: `q=.*` matches everything, and `q=(` or `q=+1555…` returns
> `500 { "code": 51091, "message": "Regular expression is invalid: …" }`. Since a leading `+`
> is the most natural way to type a phone number, **searching by phone crashes the endpoint**
> unless the client escapes the input first.

---

## Conversations

### `GET /conversations` — my conversations
`200 { "data": Conversation[] }`, newest activity first. `lastMessage` is `{}` for an empty
conversation.

### `POST /conversations` — start (or open) a direct conversation
```jsonc
{ "userId": "6a8827c5…" }        // → 200
{ "_id": "6a8827e5…", "participants": ["<me>", "<them>"], "createdAt": "2026-08-21T…" }
```
Idempotent — calling it twice returns the same `_id`.

> ⚠️ The returned object is **not** a `Conversation`: no `type`, and `participants` is an array
> of **id strings** rather than the objects the list endpoint returns. The client cannot render
> this directly; it re-fetches the list after creating.

`400 UNKNOWN_USER` for a well-formed but unknown id; `500 SERVER_ERROR` for a malformed one.

### `GET /conversations/{id}/messages` — history
Query: `limit` (default ≈50), `before` (a message `_id` to page backwards from).

```jsonc
{ "messages": Message[], "hasMore": true }
```

> ⚠️ **`messages` is newest-first (descending).** The client reverses it for display.
>
> ⚠️ **`before` is an *inclusive* cursor.** The cursor message comes back as the first item of
> the next page, so every page boundary repeats one message:
>
> ```text
> ?limit=3               → m6 m5 m4
> ?limit=3&before=<m4>   → m4 m3 m2      ← m4 again
> ```
>
> The client de-duplicates by `_id` when merging pages rather than blindly concatenating.
>
> ⚠️ `limit` is parsed with `parseInt` and any non-positive or unparseable value silently falls
> back to the default: `0`, `-5` and `abc` all return the full history, while `1.5` and `1e3`
> both return **1** message. Nothing is rejected, so a bad `limit` fails silently rather than
> loudly. A malformed `before` returns `500 SERVER_ERROR`.

`403 FORBIDDEN` if you are not a participant, `404 NOT_FOUND` if the conversation does not exist.

---

## Messages

### `POST /messages` — send
```jsonc
{ "conversationId": "6a8827e5…", "text": "Hello!" }   // → 200, the created Message
```

Returns `200`, not `201`. Works for direct and group conversations alike.

> ⚠️ **Empty and whitespace-only text is accepted** (`""` and `"   "` both persist and appear
> in history). The assignment requires empty messages to be unsendable, so this is enforced
> entirely client-side.
>
> ⚠️ Sending to a **non-existent** conversation returns **`200` with a body of literal `null`** —
> no error, no created message. A client that trusts the status code will render `undefined`.
> Missing `text` correctly returns `400 VALIDATION_ERROR`.
>
> Text is stored verbatim with no sanitisation; `<img src=x onerror=…>` round-trips intact.
> Safe under React's default escaping, but never render it as HTML.

---

## Groups

A group needs **≥ 3 members** (you + at least 2). The creator becomes the first admin. All four
endpoints return the **full updated `Conversation`**.

| Endpoint | Body | Rule |
| --- | --- | --- |
| `POST /conversations/group` | `{ name, participantIds[] }` | creator becomes admin |
| `PATCH /conversations/{id}` | `{ name }` | admins only |
| `POST /conversations/{id}/participants` | `{ userIds[] }` | admins only |
| `POST /conversations/{id}/admins` | `{ userId }` | admins only; target must be a member |
| `DELETE /conversations/{id}/participants/{userId}` | — | admins only; **own id = leave** |

Errors: `400 TOO_FEW_MEMBERS`, `400 NOT_A_MEMBER`, `400 NOT_A_GROUP` (renaming a direct chat),
`403 FORBIDDEN` (non-admin), `400 VALIDATION_ERROR` (empty `name`).

> ⚠️ The ≥3 rule is enforced **only on creation**. Members can leave a group down to 2 — or
> presumably 1 — with no error, producing groups the API would refuse to create.
> Duplicate ids in `participantIds` are de-duplicated *before* the count check, so
> `["<same>", "<same>"]` fails with `TOO_FEW_MEMBERS`.

---

## WebSocket (Socket.io)

```ts
io("https://frontend-task-chatapp.onrender.com", { auth: { token } })
```

Connect to the **root origin**, not `/api`. A missing or invalid token is rejected at the
handshake with `connect_error` carrying `No token provided` / `Invalid token`.

| Direction | Event | Payload |
| --- | --- | --- |
| client → server | `message:send` | `{ conversationId, text }`, optional ack |
| server → client | `message:new` | a message for a conversation you are in |
| server → client | `conversation:updated` | a group you are in was created/renamed/re-membered |

The `message:send` ack is `{ ok: true }` or `{ ok: false, error: "…" }` — it does **not** return
the created message.

> ⚠️ **`message:new` is a different shape from the REST `Message`.** The id field is **`id`**,
> not `_id`, and `createdAt` is an **epoch-millisecond number** instead of an ISO string. Both
> are normalised in `src/lib/normalize.ts`.
>
> ⚠️ **The sender does not receive its own `message:new`** — only the other participants do.
> Sending over the socket therefore leaves the sender with no server id and no confirmed
> timestamp, since the ack carries neither.
>
> Authorisation *is* enforced on the socket: emitting into a conversation you are not part of
> acks `{ ok: false, error: "Conversation not found" }`. (An earlier draft of this document
> claimed otherwise — the probe run in `scripts/probe-api.mjs` disproved it.)
>
> Empty text is accepted over the socket too, exactly as over REST.

### Why this client sends over REST and listens over the socket
Given the three points above, `message:send` is write-only with no useful confirmation. The
client instead **`POST`s** each message — which returns the real `_id` and `createdAt` — and
uses the socket **purely as an inbound stream** for messages from other people. This gives one clear reconciliation path (optimistic bubble →
server object from the POST response) and no possibility of a self-echo duplicate, because
the server never echoes to the sender in the first place.
