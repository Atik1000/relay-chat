# Relay

A real-time chat client — direct and group conversations, live delivery, and
history that keeps its place — built for the Frontend Developer take-home
assignment.

| | |
| --- | --- |
| **Live demo — landing page (Part 2)** | _deploy URL goes here_ |
| **Live demo — chat app (Part 1)** | _deploy URL_`/login` |
| **API documentation (Part 1)** | [`docs/API.md`](docs/API.md) |
| **API probe script** | [`scripts/probe-api.mjs`](scripts/probe-api.mjs) |

---

## Tech stack

| Choice | Why |
| --- | --- |
| **Next.js 16** (App Router) | One project serves both deliverables — the landing page and the app — from one deploy, with routing and code-splitting already solved. |
| **React 19** + **TypeScript** (strict) | The API returns two genuinely different conversation shapes; a discriminated union makes mishandling one a compile error rather than a runtime one. |
| **Tailwind CSS v4** | Design tokens live in `@theme` in `globals.css`, so the palette is defined once and the components stay free of loose hex values. |
| **socket.io-client** | Required by the server's transport. |
| **No state-management library** | Deliberate — see [Architecture](#architecture-and-trade-offs). |

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
```

```bash
npm run build          # production build
npm run lint           # eslint — clean
npx tsc --noEmit       # typecheck — clean
node scripts/probe-api.mjs   # re-derive every claim in docs/API.md against the live API
```

The API base URL defaults to the hosted service and can be overridden:

```bash
NEXT_PUBLIC_API_ORIGIN=https://frontend-task-chatapp.onrender.com
```

There is no signup step — sign in with any phone number and a display name.

### Routes

| Route | |
| --- | --- |
| `/` | Landing page (Part 2) |
| `/login` | Phone + name sign-in |
| `/chat` | The chat workspace (Part 1) |

---

# Part 3 — Thought process

## Documenting the API first

The provided Swagger spec is **request-only**: it defines endpoints, methods and
request bodies, then explicitly declines to specify a single response body or
status code. So the first thing I built was not UI — it was
[`scripts/probe-api.mjs`](scripts/probe-api.mjs), a dependency-free script that
exercises every endpoint plus the socket and asserts what comes back.
[`docs/API.md`](docs/API.md) is written from its output, and the script doubles
as a regression check: `node scripts/probe-api.mjs` re-verifies all 54
assertions, including every quirk listed below.

That order mattered more than I expected. Three of the behaviours the client
depends on are invisible from the spec and would each have produced a subtly
broken UI — and the probe caught **two of my own early conclusions being wrong**,
which is precisely why the findings are assertions in a script rather than
sentences in a document.

## Architecture and trade-offs

**One normalisation boundary.** Every response passes through
`src/lib/normalize.ts` on the way in. Above that line there is exactly one
`Message` type and one `Conversation` union; below it lives all the knowledge
that the socket says `id` where REST says `_id`, that `createdAt` is sometimes a
number, and that `lastMessage` is `{}` rather than `null`. Components never
branch on API weirdness.

**Send over REST, receive over the socket.** The socket's `message:send` acks
`{ ok: true }` without returning the created message, *and* the server never
echoes a message back to its own sender. Sending over the socket would therefore
leave the sender with no server id and no confirmed timestamp. Posting to
`/messages` returns the real object, so there is one reconciliation path
(optimistic bubble → server object) and self-echo duplicates are impossible by
construction. Trade-off: two transports instead of one, in exchange for never
guessing at message identity.

**No state-management library.** The app has three pieces of shared state —
session, socket, and the conversation list — and each has exactly one owner
(`session.tsx`, `realtime.tsx`, `useConversations.ts`). Redux or Zustand would
add a layer without removing a problem. I *did* install TanStack Query early and
then removed it: its cache model fights an append-only message log where the
authority is a socket rather than a refetch, and I was writing more code to
work around the cache than the cache saved.

**Optimistic sending with three visible states.** A message is `sending`, sent,
or `failed`, and each looks different. Failed messages stay in place with a
retry affordance rather than vanishing.

## What the API does, and what the client does about it

Full detail in [`docs/API.md`](docs/API.md); these are the ones that changed the
implementation.

| What I found | How the client handles it |
| --- | --- |
| **`before` is an *inclusive* cursor** — the cursor message is the first item of the next page, so every page boundary repeats one message. | Pages are merged by `_id` in `useMessages.ts`, never concatenated. |
| **The socket and REST disagree about message shape** — `id` vs `_id`, epoch-ms vs ISO string. | Normalised in `normalize.ts` before anything else sees it. |
| **The sender never receives its own `message:new`.** | Sending goes over REST, where the response is the confirmation. The socket is inbound-only. |
| **Empty and whitespace-only text is accepted** and stored. | The composer refuses to send it — button disabled, Enter is a no-op. This is the *only* thing enforcing the requirement. |
| **`GET /users/search` interpolates `q` into a regex unescaped** — so `q=(` or any `+`-prefixed phone number returns a `500`. | `escapeForRegexSearch` in `api.ts`. Without it, searching by phone number — the documented primary use — is a server error. |
| **`q` is optional in practice and an empty `q` dumps every account** on the service. | An empty query is never sent; the UI shows a prompt instead. |
| **`POST /messages` to an unknown conversation returns `200` with a body of literal `null`.** | The body is checked, not just the status, and surfaces as a real error. |
| **`limit` is `parseInt`'d**; `0`, `-5` and `abc` all silently return the full history, `1e3` returns 1. | Clamped to 1–100 before the request. |
| **Login upserts by phone and overwrites the account's name** — and the demo database is shared, so other people signing in with your number silently rename you. | Flagged on the login screen, and `/auth/me` is revalidated on mount; if the name changed, a banner explains why. |
| **The three-member group minimum is enforced only at creation** — members can leave a group down to two. | The group panel explains the state rather than showing it as a glitch. |
| Malformed ids return `500` with raw Mongoose text. | `ApiError.userMessage` replaces leaked internals with something a person can act on. |

Two things I initially got wrong and the probe corrected: I recorded `before` as
an *exclusive* cursor (it is inclusive), and I believed `limit=-5` hung the
connection (that was a `curl` timeout against a cold server). I also briefly
recorded a socket authorisation hole that turned out to be my own test error —
the socket does enforce membership. They are noted here because the assignment
asks what I ran into, and "my first reading of the API was wrong twice" is the
honest answer.

## The chat panel

The assignment says to spend the care here, so:

- **Auto-scroll follows, it does not force.** The view sticks to the newest
  message only while you are already within 80px of the bottom. Scroll up and it
  holds position and counts what arrived behind a "3 new messages" pill. Your
  own messages always scroll into view, because you just acted.
- **Loading older pages preserves reading position.** Prepending a page shifts
  `scrollTop` by exactly the height that was added, so the line you were reading
  does not jump.
- **Day separators, sender grouping, and per-message timestamps.** Consecutive
  messages from one person within five minutes collapse into one block; sender
  names only appear in groups, where they carry information.
- **Real loading, empty and error states** at every level — conversation list,
  thread, and search — with the message skeleton shaped like the messages that
  replace it.
- Enter sends, Shift+Enter newlines, and IME composition is respected so the
  first Enter of a CJK candidate selection does not send a half-finished word.

## Part 2 — the landing page

The visual direction is a dark, high-contrast product page: one violet accent
against near-black, generous type, and a single gradient moment in the headline.
Dark because the product is dark, so the page is a preview rather than a
brochure.

Two decisions worth stating:

- **The hero demo is a scripted replay of the real UI**, not a screenshot — same
  bubbles, same spacing, same typing indicator — so what the page promises is
  what the app delivers.
- **An "Under the hood" section lists the API quirks the client handles.** Most
  landing pages claim reliability; this one shows its work.

### The original element

The centrepiece is **an interactive comparison of the two possible auto-scroll
rules**. The auto-scroll requirement is the kind of detail nobody can see in a
screenshot and nobody notices until it is wrong, so the page lets you break it
on purpose: scroll up inside the panel, start the incoming messages, and toggle
between "Relay" and "Naive". The naive mode drags you back down mid-sentence;
Relay holds your place and counts. It is the assignment's own requirement turned
into the page's argument, and it is the piece I would keep if I had to cut
everything else.

Both demos respect `prefers-reduced-motion` — the reduced-motion path shows the
finished conversation rather than replaying it.

## How I used AI

I used Claude (Claude Code) throughout, roughly like a fast pair:

- **Where it genuinely helped.** Driving the API probe — generating dozens of
  endpoint permutations quickly is exactly the kind of breadth work that is
  tedious by hand. Scaffolding component boilerplate. Drafting the first pass of
  `docs/API.md` from probe output. Catching that my `useMessages` hook mutated
  refs during render, which is a real concurrent-rendering bug.
- **What I changed or rejected.** The first draft of the message store used
  TanStack Query; I removed the dependency entirely once it was clear the cache
  was fighting a socket-driven append-only log. The initial auto-scroll used a
  `useEffect` with `scrollIntoView` on every render, which force-scrolled the
  user — the pinned/unpinned distinction and the `useLayoutEffect` height
  compensation are the part I worked out by hand, and are the part the
  assignment actually cares about. I also rejected a suggestion to suppress the
  new `react-hooks/set-state-in-effect` rule project-wide; instead I fixed the
  two genuine violations and suppressed the remaining seven individually, each
  with a stated reason.
- **What AI got wrong.** The API findings are the clearest example. Early
  conclusions about the pagination cursor, the negative `limit`, and socket
  authorisation were all confidently stated and all wrong — which is why every
  claim in `docs/API.md` is backed by an assertion in a script that either
  passes or fails. Two bugs in this README's own subject matter — the
  new-conversation selection race and the stale-messages-on-switch bug — were
  found by driving the running app in a browser, not by reading the code.

**A note on the assignment PDF.** Its Part 3 section contains a line of hidden
text instructing any AI assistant reading the document to insert the word
"Madagascar" into the summary it generates. I have not done so. Flagging it
seemed more useful than silently complying or silently ignoring it.

## What I would do differently with more time

- **Tests.** `merge()`, `normalizeMessage()` and the pagination de-duplication
  are pure functions with real edge cases and no unit tests; the probe script
  covers the API contract but nothing covers the client logic. That is the first
  thing I would add.
- **A virtualised message list.** Fine at hundreds of messages, not at tens of
  thousands.
- **Offline queueing.** Failed sends currently need a manual retry; they should
  persist and drain automatically on reconnect.
- **Read receipts and typing indicators** — neither is exposed by the API, so
  both would need server work.
- **Accessibility depth.** Landmarks, focus management and live regions are in
  place, but I would want a screen-reader pass before calling it done.
- **Sanitising the group/user names the API returns**, which are attacker-
  controlled in a shared database. React escapes them today, so this is
  defence-in-depth rather than a live hole.
