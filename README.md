# Relay

A real-time chat client — direct and group conversations, live delivery, and
history that keeps its place. Built for the Frontend Developer take-home
assignment.

| | |
| --- | --- |
| **Landing page** (Part 2) | https://relay-chat-theta.vercel.app |
| **Chat app** (Part 1) | https://relay-chat-theta.vercel.app/login |
| **Repository** | https://github.com/Atik1000/relay-chat |

## Docs

| | |
| --- | --- |
| [`docs/API.md`](docs/API.md) | API reference, written by hand from a live probe |
| [`docs/WRITE-UP.md`](docs/WRITE-UP.md) | Part 3 — approach, trade-offs, AI use, issues found |
| [`scripts/probe-api.mjs`](scripts/probe-api.mjs) | Re-derives every claim in the API docs (58 assertions) |

## Tech stack

**Next.js 16** (App Router) · **React 19** · **TypeScript** (strict) ·
**Tailwind CSS v4** · **socket.io-client**

No state-management library: the app has three pieces of shared state — session,
socket, conversation list — and each has exactly one owner.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck
node scripts/probe-api.mjs   # verify the API docs against the live service
```

The API origin is optional and defaults to the hosted service:

```bash
NEXT_PUBLIC_API_ORIGIN=https://frontend-task-chatapp.onrender.com
```

> The upstream API runs on Render's free tier. If it has been idle the first
> request wakes it up and can take ~50 seconds. That is the server cold-starting,
> not the client hanging.

## Routes

| | |
| --- | --- |
| `/` | Landing page (Part 2) |
| `/login` | Phone + name sign-in — no separate signup |
| `/chat` | Chat workspace (Part 1) |

## Structure

```
src/
  lib/          data layer — api client, normalisers, session, socket, hooks
  components/   chat panel, landing sections, shared primitives
  app/          routes
docs/           API reference and the Part 3 write-up
scripts/        API probe
```

## Notes worth knowing

The supplied Swagger spec documents requests but **no response bodies or status
codes**, so the response shapes were recovered by probing the live API. Several
findings changed the implementation:

- `before` is an **inclusive** cursor — pages are merged by `_id`, not concatenated
- the socket sends `id` + epoch-ms where REST sends `_id` + ISO strings
- the server never echoes a message to its own sender, so sending goes over REST
- empty and whitespace-only messages are accepted by the API — the client blocks them
- `q` reaches a Mongo regex unescaped, so phone numbers must be escaped or search 500s

Full detail, and what the client does about each, is in
[`docs/WRITE-UP.md`](docs/WRITE-UP.md).
