import Link from "next/link";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { ScrollLab } from "@/components/landing/ScrollLab";
import { ClosingCta, HeaderCta, HeroCta } from "@/components/landing/SessionCta";

const FEATURES = [
  {
    title: "Messages land instantly",
    body: "A single authenticated socket streams every message the moment it is sent. No polling, no refresh, no waiting to find out someone replied.",
    icon: BoltIcon,
  },
  {
    title: "Direct chats and groups",
    body: "Start a one-to-one chat from a name or a phone number, or build a group with admins who can rename it, add people, and hand over control.",
    icon: PeopleIcon,
  },
  {
    title: "History that keeps its place",
    body: "Scroll back through the whole conversation. Older pages load as you reach them, and the message you were reading stays under your cursor.",
    icon: HistoryIcon,
  },
  {
    title: "Honest about the network",
    body: "Sent, sending, and failed are three different things, and Relay shows you which one you are looking at. Failed messages retry with one tap.",
    icon: SignalIcon,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <SiteHeader />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative px-5 pb-20 pt-14 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-56 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[140px]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_auto]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs text-ink-muted">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Real-time messaging
            </span>

            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Messaging that
              <br />
              <span className="bg-gradient-to-r from-brand via-fuchsia-400 to-accent bg-clip-text text-transparent">
                keeps up with you
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
              Relay is a chat client built around the parts people actually
              notice: messages that arrive the instant they are sent, history
              that never loses your place, and a thread that refuses to yank you
              around while you are reading it.
            </p>

            <HeroCta />
          </div>

          <div className="flex justify-center lg:justify-end">
            <LiveDemo />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface/30 px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a conversation needs, and nothing it doesn&apos;t
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ title, body, icon: Icon }) => (
              <article
                key={title}
                className="rounded-2xl border border-line bg-surface p-6 transition hover:border-brand/40"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft/40 text-brand">
                  <Icon />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive proof ─────────────────────────────────────── */}
      <section id="scroll-lab" className="scroll-mt-20 px-5 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand">
              The detail nobody screenshots
            </span>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Auto-scroll should follow you, not fight you
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-ink-muted">
              Almost every chat app force-scrolls to the newest message. That is
              right up until you scroll back to read something — then each new
              message rips the thread out from under you.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-ink-muted">
              Relay only follows the conversation when you are already at the
              bottom. Scroll up and it holds position, counts what arrived, and
              waits for you to ask for it. You can&apos;t see that in a
              screenshot, so try it:
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-muted">
              {[
                "Scroll up inside the panel",
                "Press “Start messages”",
                "Switch between Relay and Naive",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <ScrollLab />
        </div>
      </section>

      {/* ── Engineering notes ─────────────────────────────────────── */}
      <section className="border-t border-line bg-surface/30 px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Under the hood
          </span>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Built against the API as it actually behaves
          </h2>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-ink-muted">
            The upstream service has a handful of sharp edges. Rather than paper
            over them, Relay handles each one deliberately — and documents it.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Inclusive pagination cursor", "Paging backwards repeats the cursor message, so pages are merged by id instead of concatenated."],
              ["Two shapes for one message", "The socket sends id and epoch milliseconds; REST sends _id and ISO strings. Both are normalised at the edge."],
              ["No echo to the sender", "The server never sends your own message back, so sending goes over REST where the response confirms it."],
              ["Empty messages accepted", "The API stores \"\" and \"   \" happily. The composer refuses to send them."],
              ["Search crashes on “+”", "Queries are interpolated into a regex unescaped, so phone numbers are escaped before they are sent."],
              ["Silent reconnect gaps", "Missed messages are never replayed, so every reconnect reconciles against history."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-faint">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[120px]"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <ClosingCta />
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-ink-faint sm:flex-row">
          <p>Relay — built for the frontend take-home assignment.</p>
          <Link href="/chat" className="transition hover:text-ink">
            Go to the app →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
              <path d="M3 6.5C3 4.6 4.6 3 6.5 3h3a3.5 3.5 0 0 1 0 7H7l-3 2.5v-2.7A3.5 3.5 0 0 1 3 6.5Z" fill="currentColor" />
            </svg>
          </span>
          Relay
        </Link>
        <HeaderCta />
      </div>
    </header>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <path d="M11 2 4 11h4l-1 7 7-9h-4l1-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <circle cx="7.5" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="8.2" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 16c0-2.6 2.2-4.2 5-4.2s5 1.6 5 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 12c2.3 0 3.8 1.3 3.8 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <path d="M3 10a7 7 0 1 0 2.1-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2v4h4M10 6v4.4l3 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <path d="M3 12.5v3M7.7 9.5v6M12.3 6.5v9M17 3.5v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
