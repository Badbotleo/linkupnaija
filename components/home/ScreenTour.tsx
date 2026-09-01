"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LineIcon from "../ui/LineIcon";
import { LogoMark } from "../Logo";
import EventCover from "../EventCover";

/**
 * A phone playing through what using LinkUpNaija
 * actually looks like — the "watch it work before you sign up" panel.
 *
 * The screens are real markup rather than screenshots, so they can't go stale
 * when the product changes and they stay sharp on any display.
 */

const STEPS = [
  {
    label: "Find something on",
    text: "Browse what's actually happening near you this week, filtered by the vibe you're in.",
  },
  {
    label: "Ask to join",
    text: "Send a request. The host sees who you are and approves you. That's why nobody shows up to a room full of randos.",
  },
  {
    label: "Meet the room first",
    text: "Every link-up gets a group chat, so you've already spoken to people before you pull up.",
  },
  {
    label: "Bring your paddy",
    text: "Share your invite link, split the ride, and get credit when your people join.",
  },
];

const STEP_MS = 4200;

export interface TourEvent {
  id: string;
  title: string;
  category: string;
  state: string | null;
  date: string;
  price: number | null;
  cover_image_url: string | null;
}

export default function ScreenTour({ events = [] }: { events?: TourEvent[] }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // Only run while it's on screen and motion is welcome — an animation the
  // visitor has scrolled past is pure battery drain.
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={box} className="container-page mt-10">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-brand-50 via-white to-naija-50 p-5 shadow-card sm:p-7">
        <div className="grid grid-cols-1 items-center gap-7 lg:grid-cols-[0.85fr_1fr]">
          {/* ---------------- the screen ---------------- */}
          <div className="order-1">
            <div className="mx-auto w-full max-w-[200px]">
              {/* An iPhone, not a laptop.

                  The old frame was a browser window — traffic-light dots and
                  a URL bar — a desktop chrome around a product almost nobody
                  opens on a desktop. It quietly told a visitor to go and use
                  their computer, which is the opposite of the truth. This is
                  a phone product used standing up, and the frame should say
                  so before the copy gets a chance to. */}
              <div className="relative mx-auto w-full max-w-[200px] rounded-[2.2rem] border-[3px] border-gray-800 bg-gray-900 p-2 shadow-2xl">
                {/* Side buttons — small, but their absence is what makes a
                    rounded rectangle read as a mockup rather than a phone. */}
                <span className="absolute -left-[5px] top-[70px] h-7 w-[3px] rounded-l bg-gray-700" />
                <span className="absolute -left-[5px] top-[104px] h-7 w-[3px] rounded-l bg-gray-700" />
                <span className="absolute -right-[5px] top-[84px] h-11 w-[3px] rounded-r bg-gray-700" />

                <div className="relative overflow-hidden rounded-[1.7rem] bg-gray-50">
                  <div className="absolute left-1/2 top-2 z-20 h-[18px] w-[68px] -translate-x-1/2 rounded-full bg-black" />

                  {/* Status bar. A phone frame with a blank strip above the
                      app reads as a mockup; the time, signal and battery are
                      what make the same pixels read as a screenshot. Fixed
                      values, not the real clock — a demo that ticks is a demo
                      that re-renders, and nobody is checking the time in a
                      marketing panel. */}
                  <div className="absolute inset-x-0 top-0 z-10 flex h-7 items-center justify-between px-3 text-[9px] font-semibold text-gray-900">
                    <span className="tabular-nums">9:41</span>
                    <span className="flex items-center gap-[3px]">
                      {/* signal */}
                      <svg width="11" height="8" viewBox="0 0 14 10" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                          <rect
                            key={i}
                            x={i * 3.6}
                            y={9 - (i + 1) * 2.2}
                            width="2.4"
                            height={(i + 1) * 2.2}
                            rx="0.6"
                            fill="currentColor"
                          />
                        ))}
                      </svg>
                      {/* wifi */}
                      <svg width="10" height="8" viewBox="0 0 12 10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                        <path d="M1 3.4a7.5 7.5 0 0 1 10 0M3 5.7a4.5 4.5 0 0 1 6 0" />
                        <circle cx="6" cy="8.3" r="0.8" fill="currentColor" stroke="none" />
                      </svg>
                      {/* battery */}
                      <svg width="16" height="8" viewBox="0 0 20 10" aria-hidden>
                        <rect x="0.5" y="0.5" width="16" height="9" rx="2.5" fill="none" stroke="currentColor" strokeOpacity="0.4" />
                        <rect x="2" y="2" width="11" height="6" rx="1.5" fill="currentColor" />
                        <path d="M18 3.6v2.8a1.6 1.6 0 0 0 0-2.8z" fill="currentColor" fillOpacity="0.4" />
                      </svg>
                    </span>
                  </div>

                  <div className="relative h-[412px]">
                    {STEPS.map((_, n) => (
                      <div
                        key={n}
                        className={`absolute inset-0 p-3 pt-9 transition-[transform,opacity] duration-500 ${
                          n === i
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-3 opacity-0"
                        }`}
                      >
                        <Screen n={n} events={events} />
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-x-0 bottom-1.5 z-20 flex justify-center">
                    <span className="h-[4px] w-[80px] rounded-full bg-gray-900/25" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- the steps ---------------- */}
          <div className="order-2">
            {/* Small on a phone, full size on a desktop.

                This block used to sit above the demo on mobile — an eyebrow,
                a 24px headline and four expanded steps, so a visitor scrolled
                most of a screen of text before anything moved. The phone is
                the part that holds attention; it now goes first, and the
                words explain what they are already looking at. */}
            <p className="hidden text-[11px] font-black uppercase tracking-[0.2em] text-brand lg:block">
              See how it works
            </p>
            <h2 className="mt-3 text-center text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 lg:mt-1.5 lg:text-left lg:text-[28px]">
              Four taps from bored to booked.
            </h2>

            {/* Dots on a phone, the full list on a desktop. Four stacked
                buttons is another screenful of reading under a demo that has
                already made the point. */}
            <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
              {STEPS.map((s2, n) => (
                <button
                  key={s2.label}
                  type="button"
                  onClick={() => setI(n)}
                  aria-label={`Step ${n + 1}: ${s2.label}`}
                  aria-current={n === i}
                  className={`h-1.5 rounded-full transition-[width] ${
                    n === i ? "w-6 bg-brand" : "w-1.5 bg-gray-300"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2.5 text-center lg:hidden">
              <p className="text-[15px] font-extrabold text-gray-900">
                {STEPS[i].label}
              </p>
              <p className="mx-auto mt-0.5 max-w-xs text-[13px] leading-relaxed text-gray-600">
                {STEPS[i].text}
              </p>
            </div>

            <ol className="mt-4 hidden space-y-1 lg:block">
              {STEPS.map((s, n) => {
                const on = n === i;
                return (
                  <li key={s.label}>
                    <button
                      type="button"
                      onClick={() => setI(n)}
                      aria-current={on}
                      className={`flex w-full gap-3 rounded-2xl p-3 text-left transition ${
                        on ? "bg-white shadow-card" : "hover:bg-white/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[12px] font-black transition ${
                          on ? "bg-brand text-white" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {n + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block font-extrabold ${
                            on ? "text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {s.label}
                        </span>
                        {on && (
                          <span className="mt-0.5 block text-[13px] leading-relaxed text-gray-600">
                            {s.text}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <Link
              href="/signup"
              className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 lg:mx-0 lg:inline-flex"
            >
              Try it yourself
              <LineIcon name="chevronRight" size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The four fake-but-faithful app screens                              */
/* ------------------------------------------------------------------ */

/**
 * The app's own chrome, not a generic card.
 *
 * The point of this panel is "here is the thing you are about to use", so a
 * neutral white box with a title undercuts it. This carries the real header
 * and the real bottom bar, in the same colours and at the same proportions,
 * so what a visitor sees in the frame is what they get when they tap through.
 */
function Chrome({
  title,
  children,
  tab = 0,
}: {
  title: string;
  children: React.ReactNode;
  /** Which bottom-bar icon is lit, so the demo moves like navigation does. */
  tab?: number;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white pt-7">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2">
        {/* The real mark. A letter in a circle was a stand-in, and a demo
            whose job is "this is the app" cannot show a logo the app has
            never used. */}
        <LogoMark size={15} />
        <span className="truncate text-[12px] font-extrabold text-gray-900">
          {title}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2.5">{children}</div>

      {/* The real bottom bar, five icons, no labels — same as the app. */}
      <div className="flex items-center justify-around border-t border-gray-100 px-2 py-1.5">
        {["home", "search", "plus", "bell", "user"].map((ic, k) => (
          <span
            key={ic}
            className={`grid h-6 w-6 place-items-center rounded-full ${
              ic === "plus"
                ? "bg-brand text-white"
                : k === tab
                  ? "bg-brand/10 text-brand"
                  : "text-gray-400"
            }`}
          >
            <LineIcon
              name={ic === "plus" ? "sparkles" : ic === "search" ? "search" : ic === "bell" ? "bell" : ic === "user" ? "users" : "home"}
              size={12}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function Screen({ n, events }: { n: number; events: TourEvent[] }) {
  // Real listings. An invented "Rooftop sundowner" is a promise the site
  // can't keep — a visitor taps through and finds a different world. These
  // are the same rows the feed is showing right now, so the demo is the
  // product rather than a drawing of it.
  // Six, not three. The screen is 412px tall and three rows left half of it
  // empty, which reads as a phone with nothing on it — the opposite of what a
  // demo of a busy events app should show.
  const feed = events.slice(0, 6);

  if (n === 0)
    return (
      <Chrome title="Explore" tab={1}>
        <div className="flex gap-1.5">
          {(feed.length > 0
            ? Array.from(new Set(feed.map((e) => e.category))).slice(0, 3)
            : ["Party", "Game Night", "Beach Day"]
          ).map((c, k) => (
            <span
              key={c}
              className={`truncate rounded-full px-2 py-1 text-[9px] font-bold ${
                k === 0 ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {feed.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-xl border border-gray-100 p-1.5"
            >
              {/* EventCover, not a raw <img>. These flyers are 400KB+ and were
                  being downloaded at full size into a 36px box — slow enough
                  on a phone connection that the browser was still showing its
                  broken-image mark when the page settled. next/image serves a
                  thumbnail, and falls back to the category art if a URL ever
                  breaks. */}
              <EventCover
                url={e.cover_image_url}
                category={e.category}
                title={e.title}
                className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"
              />
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold text-gray-900">
                  {e.title}
                </span>
                <span className="block truncate text-[9px] text-gray-500">
                  {e.state ?? "Nigeria"} ·{" "}
                  {e.price && e.price > 0
                    ? `₦${e.price.toLocaleString("en-NG")}`
                    : "Free"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Chrome>
    );

  if (n === 1) {
    const e = feed[0];
    return (
      <Chrome title={e?.title ?? "Request to join"} tab={1}>
        {e ? (
          <EventCover
            url={e.cover_image_url}
            category={e.category}
            title={e.title}
            className="h-16 w-full overflow-hidden rounded-xl"
          />
        ) : (
          <div className="h-16 rounded-xl bg-gradient-to-br from-brand to-[#121212]" />
        )}
        {/* The same promise the event page leads with, in the same words. */}
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-brand/15 bg-brand/[0.04] p-1.5">
          <span className="mt-[1px] text-brand">
            <LineIcon name="shield" size={11} />
          </span>
          <span className="text-[9px] font-bold leading-snug text-gray-800">
            The host approves every guest
          </span>
        </div>
        <div className="mt-2 rounded-xl bg-brand px-3 py-2 text-center text-[10px] font-bold text-white">
          Request to join
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-naija-50 px-2 py-1.5">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-naija text-[8px] font-black text-white">
            ✓
          </span>
          <span className="text-[9px] font-semibold text-emerald-800">
            Request sent. You&apos;ll hear back
          </span>
        </div>
      </Chrome>
    );
  }

  if (n === 2)
    return (
      <Chrome title={feed[0] ? `${feed[0].title.slice(0, 22)} chat` : "Group chat"} tab={3}>
        <div className="space-y-1.5">
          {/* Real listings above, illustrative messages here — actual chats
              are private and showing them would be a straightforward breach.
              So the copy stays generic enough to be true of any link-up
              rather than describing a venue the event doesn't have. */}
          <Bubble side="left" name="Host">
            Doors from 6. I&apos;ll drop the exact spot here 📍
          </Bubble>
          <Bubble side="left" name="Amaka">
            Anyone coming from my side? Let&apos;s share a ride
          </Bubble>
          <Bubble side="right" name="You">
            I&apos;m close by, I can pick up 👋
          </Bubble>
        </div>
      </Chrome>
    );

  return (
    <Chrome title="Bring your paddy" tab={4}>
      <div className="rounded-xl border border-dashed border-brand/40 bg-brand-50 p-2.5">
        <p className="text-[10px] font-semibold text-gray-500">Your invite link</p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-brand">
          linkupnaija.com/r/tobi
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        {["Amaka joined", "Chidi joined", "Zainab joined"].map((t) => (
          <div key={t} className="flex items-center gap-2 rounded-xl border border-gray-100 p-2">
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-[#FAC775] to-naija" />
            <span className="text-[11px] font-semibold text-gray-800">{t}</span>
            <span className="ml-auto text-[10px] font-black text-naija">+1</span>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function Bubble({
  side,
  name,
  children,
}: {
  side: "left" | "right";
  name: string;
  children: React.ReactNode;
}) {
  const right = side === "right";
  return (
    <div className={`flex ${right ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!right && (
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
            {name}
          </p>
        )}
        <p
          className={`rounded-2xl px-2.5 py-1.5 text-[11px] leading-snug ${
            right ? "bg-brand text-white" : "bg-gray-100 text-gray-800"
          }`}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
