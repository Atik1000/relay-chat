/**
 * Reproduces every finding in docs/API.md against the live service.
 *
 * The provided Swagger document specifies requests but no responses, so this script
 * is how the response shapes, status codes and quirks in that document were derived.
 * It is deliberately dependency-free apart from socket.io-client.
 *
 *   node scripts/probe-api.mjs
 */
import { io } from "socket.io-client";

const ORIGIN = process.env.API_ORIGIN ?? "https://frontend-task-chatapp.onrender.com";
const BASE = `${ORIGIN}/api`;
const stamp = Date.now();

let pass = 0;
let fail = 0;

/** Fetch that never throws, so one dead endpoint cannot abort the run. */
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => ({ status: 0, _err: e.message }));

  if (res.status === 0) return { status: 0, body: null, error: res._err };
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

const login = (n) =>
  call("POST", "/auth/login", { body: { phone: `+1555${stamp}`.slice(0, 12) + n, name: `Probe ${n}` } });

console.log(`Probing ${ORIGIN}\n(Render free tier — the first call may take ~50s to cold-start.)`);

// ── Auth ──────────────────────────────────────────────────────────────────────
section("Auth");
const a = await login(1);
const b = await login(2);
const c = await login(3);
check("POST /auth/login → 200", a.status, 200);
check("login returns a token", typeof a.body?.token, "string");
check("login returns user._id", typeof a.body?.user?._id, "string");

const [tokenA, tokenB] = [a.body.token, b.body.token];
const [idB, idC] = [b.body.user._id, c.body.user._id];

check("login without name → 400",
  (await call("POST", "/auth/login", { body: { phone: "+15550000000" } })).status, 400);
check("QUIRK phone is never validated ('abc' accepted)",
  (await call("POST", "/auth/login", { body: { phone: "abc" + stamp, name: "No Validation" } })).status, 200);

const renamed = await call("POST", "/auth/login", {
  body: { phone: a.body.user.phone, name: "Overwritten By Someone Else" },
});
check("QUIRK re-login OVERWRITES the existing account's name",
  renamed.body?.user?.name, "Overwritten By Someone Else");

check("GET /auth/me returns a bare user (no wrapper)",
  typeof (await call("GET", "/auth/me", { token: tokenA })).body?.token, "undefined");
check("QUIRK missing token → 400, not 401", (await call("GET", "/auth/me")).status, 400);
check("invalid token → 401", (await call("GET", "/auth/me", { token: "garbage" })).status, 401);

// ── Users ─────────────────────────────────────────────────────────────────────
section("Users");
check("GET /users/search returns a BARE ARRAY",
  Array.isArray((await call("GET", "/users/search?q=Probe", { token: tokenA })).body), true);

const noQ = await call("GET", "/users/search", { token: tokenA });
check("QUIRK 'q' is documented required but is optional", noQ.status, 200);
check("QUIRK absent 'q' dumps the whole user table", noQ.body.length > 0, true);

check("QUIRK regex injection — 'q=(' → 500",
  (await call("GET", "/users/search?q=" + encodeURIComponent("("), { token: tokenA })).status, 500);
check("QUIRK a leading '+' (i.e. any phone number) → 500",
  (await call("GET", "/users/search?q=" + encodeURIComponent("+1555"), { token: tokenA })).status, 500);
check("QUIRK 'q=.*' is executed as a regex and matches everyone",
  (await call("GET", "/users/search?q=" + encodeURIComponent(".*"), { token: tokenA })).body.length > 0, true);

// ── Conversations ─────────────────────────────────────────────────────────────
section("Conversations");
const list = await call("GET", "/conversations", { token: tokenA });
check("GET /conversations is wrapped in { data }", Array.isArray(list.body?.data), true);

const direct = await call("POST", "/conversations", { token: tokenA, body: { userId: idB } });
check("POST /conversations → 200 (not 201)", direct.status, 200);
check("POST /conversations is idempotent",
  (await call("POST", "/conversations", { token: tokenA, body: { userId: idB } })).body._id,
  direct.body._id);
check("QUIRK the created object has no 'type' field", direct.body.type, undefined);
check("QUIRK participants are id STRINGS here, objects in the list",
  typeof direct.body.participants[0], "string");
check("unknown user id → 400",
  (await call("POST", "/conversations", { token: tokenA, body: { userId: "deadbeefdeadbeefdeadbeef" } })).status, 400);
check("QUIRK malformed id → 500 leaking raw Mongoose text",
  (await call("POST", "/conversations", { token: tokenA, body: { userId: "nope" } })).status, 500);

const cid = direct.body._id;
await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "one" } });
await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "two" } });
await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "three" } });

// ── History ───────────────────────────────────────────────────────────────────
section("History & pagination");
const hist = await call("GET", `/conversations/${cid}/messages`, { token: tokenA });
check("history is { messages, hasMore }", Array.isArray(hist.body?.messages), true);
check("QUIRK messages are newest-FIRST (descending)",
  new Date(hist.body.messages[0].createdAt) >= new Date(hist.body.messages.at(-1).createdAt), true);

const page = await call("GET", `/conversations/${cid}/messages?limit=2`, { token: tokenA });
check("limit is honoured", page.body.messages.length, 2);
check("hasMore reports a further page", page.body.hasMore, true);

const cursor = page.body.messages.at(-1);
const older = await call("GET",
  `/conversations/${cid}/messages?limit=2&before=${cursor._id}`, { token: tokenA });
check("QUIRK 'before' is INCLUSIVE — the cursor repeats on the next page",
  older.body.messages[0]._id, cursor._id);

for (const bad of ["0", "-5", "abc"]) {
  check(`QUIRK limit=${bad} silently falls back to the default`,
    (await call("GET", `/conversations/${cid}/messages?limit=${bad}`, { token: tokenA }))
      .body.messages.length > 2, true);
}
check("QUIRK limit is parseInt'd — '1e3' becomes 1, not 1000",
  (await call("GET", `/conversations/${cid}/messages?limit=1e3`, { token: tokenA })).body.messages.length, 1);

check("QUIRK malformed 'before' → 500",
  (await call("GET", `/conversations/${cid}/messages?before=nope`, { token: tokenA })).status, 500);
check("non-participant → 403",
  (await call("GET", `/conversations/${cid}/messages`, { token: c.body.token })).status, 403);
check("unknown conversation → 404",
  (await call("GET", "/conversations/deadbeefdeadbeefdeadbeef/messages", { token: tokenA })).status, 404);

// ── Messages ──────────────────────────────────────────────────────────────────
section("Messages");
check("POST /messages → 200 (not 201)",
  (await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "hi" } })).status, 200);
check("QUIRK empty text is ACCEPTED — must be blocked client-side",
  (await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "" } })).status, 200);
check("QUIRK whitespace-only text is ACCEPTED",
  (await call("POST", "/messages", { token: tokenA, body: { conversationId: cid, text: "   " } })).status, 200);
check("missing 'text' → 400",
  (await call("POST", "/messages", { token: tokenA, body: { conversationId: cid } })).status, 400);

const ghost = await call("POST", "/messages",
  { token: tokenA, body: { conversationId: "deadbeefdeadbeefdeadbeef", text: "hi" } });
check("QUIRK unknown conversation → 200 with a body of literal null", `${ghost.status}:${ghost.body}`, "200:null");

check("QUIRK text is stored verbatim, unsanitised",
  (await call("POST", "/messages",
    { token: tokenA, body: { conversationId: cid, text: "<img src=x onerror=alert(1)>" } })
  ).body.text, "<img src=x onerror=alert(1)>");

// ── Groups ────────────────────────────────────────────────────────────────────
section("Groups");
check("a group of 2 is rejected",
  (await call("POST", "/conversations/group",
    { token: tokenA, body: { name: "Too Small", participantIds: [idB] } })).status, 400);
check("QUIRK duplicate ids are de-duped BEFORE the count check",
  (await call("POST", "/conversations/group",
    { token: tokenA, body: { name: "Dup", participantIds: [idB, idB] } })).body?.error?.code, "TOO_FEW_MEMBERS");
check("empty group name → 400",
  (await call("POST", "/conversations/group",
    { token: tokenA, body: { name: "", participantIds: [idB, idC] } })).status, 400);

const group = await call("POST", "/conversations/group",
  { token: tokenA, body: { name: `Probe Group ${stamp}`, participantIds: [idB, idC] } });
check("create group → full conversation with type 'group'", group.body.type, "group");
check("the creator is the first admin", group.body.admins[0], a.body.user._id);

const gid = group.body._id;
check("rename by an admin → 200",
  (await call("PATCH", `/conversations/${gid}`, { token: tokenA, body: { name: "Renamed" } })).status, 200);
check("rename by a non-admin → 403",
  (await call("PATCH", `/conversations/${gid}`, { token: tokenB, body: { name: "Hijacked" } })).status, 403);
check("renaming a DIRECT conversation → 400 NOT_A_GROUP",
  (await call("PATCH", `/conversations/${cid}`, { token: tokenA, body: { name: "Nope" } })).body?.error?.code,
  "NOT_A_GROUP");
check("promoting a non-member → 400 NOT_A_MEMBER",
  (await call("POST", `/conversations/${gid}/admins`,
    { token: tokenA, body: { userId: "6a8826abe5d6aac97521e28f" } })).body?.error?.code, "NOT_A_MEMBER");

const left = await call("DELETE", `/conversations/${gid}/participants/${idB}`, { token: tokenB });
check("QUIRK a member may leave a group down to 2 — below the enforced minimum",
  left.body.participants.length, 2);

// ── WebSocket ─────────────────────────────────────────────────────────────────
section("WebSocket");
const rejected = await new Promise((resolve) => {
  const s = io(ORIGIN, { auth: { token: "garbage" }, transports: ["websocket"], reconnection: false });
  s.on("connect_error", (e) => { s.close(); resolve(e.message); });
  s.on("connect", () => { s.close(); resolve("connected"); });
});
check("an invalid token is rejected at the handshake", rejected, "Invalid token");

const sockA = io(ORIGIN, { auth: { token: tokenA }, transports: ["websocket"] });
const sockB = io(ORIGIN, { auth: { token: tokenB }, transports: ["websocket"] });
const inbox = { a: [], b: [] };
sockA.on("message:new", (m) => inbox.a.push(m));
sockB.on("message:new", (m) => inbox.b.push(m));
await new Promise((r) => { let n = 0; const d = () => ++n === 2 && r(); sockA.on("connect", d); sockB.on("connect", d); });

const ack = await new Promise((r) =>
  sockA.emit("message:send", { conversationId: cid, text: `socket ${stamp}` }, r));
check("message:send acks { ok: true }", ack.ok, true);
check("QUIRK the ack does NOT return the created message", ack.message ?? ack._id ?? ack.id, undefined);

await new Promise((r) => setTimeout(r, 2500));
check("the recipient receives message:new", inbox.b.length > 0, true);
check("QUIRK the SENDER never receives its own message:new", inbox.a.length, 0);
check("QUIRK message:new uses 'id', REST uses '_id'", typeof inbox.b.at(-1)?.id, "string");
check("QUIRK message:new createdAt is an epoch NUMBER, REST is an ISO string",
  typeof inbox.b.at(-1)?.createdAt, "number");

const forbidden = await new Promise((r) =>
  sockA.emit("message:send", { conversationId: "deadbeefdeadbeefdeadbeef", text: "intruder" }, r));
check("the socket DOES enforce authorisation", forbidden.ok, false);

sockA.close();
sockB.close();

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
process.exit(fail === 0 ? 0 : 1);
