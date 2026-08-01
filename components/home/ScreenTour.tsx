"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LineIcon from "../ui/LineIcon";

/**
 * A phone sitting in a laptop frame, playing through what using LinkUpNaija
 * actually looks like — the "watch it work before you sign up" panel.
 *
 * The screens are real markup rather than screenshots, so they can't go stale
 * when the product changes and they stay sharp on any display.
 */

const STEPS = [
  {
    label: "Find something on",
    text: "Browse what's actually happening near you this week — filtered by the vibe you're in.",
  },
  {
    label: "Ask to join",
    text: "Send a request. The host sees who you are and approves you — that's why nobody shows up to a room full of randos.",
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

export default function ScreenTour() {
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
        <div className="grid grid-cols-1 items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
          {/* ---------------- the screen ---------------- */}
          <div className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-[420px]">
              {/* laptop lid */}
              <div className="rounded-t-2xl border border-b-0 border-gray-300 bg-gray-900 p-2 pb-0 shadow-xl">
                <div className="flex items-center gap-1.5 px-1 pb-2">
                  <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                  <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                  <span className="h-2 w-2 rounded-full bg-[#28C840]" />
                  <span className="ml-2 truncate rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                    linkupnaija.com
                  </span>
                </div>
                <div className="relative h-[292px] overflow-hidden rounded-t-lg bg-gray-50">
                  {STEPS.map((_, n) => (
                    <div
                      key={n}
                      className={`absolute inset-0 p-3 transition-all duration-500 ${
                        n === i
                          ? "translate-y-0 opacity-100"
                          : "pointer-events-none translate-y-3 opacity-0"
                      }`}
                    >
                      <Screen n={n} />
                    </div>
                  ))}
                </div>
              </div>
              {/* laptop base */}
              <div className="mx-auto h-3 rounded-b-xl border border-t-0 border-gray-300 bg-gradient-to-b from-gray-200 to-gray-300" />
              <div className="mx-auto h-1 w-1/4 rounded-b-full bg-gray-300/70" />
            </div>
          </div>

          {/* ---------------- the steps ---------------- */}
          <div className="order-1 lg:order-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">
              See how it works
            </p>
            <h2 className="mt-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-[28px]">
              Four taps from bored to booked.
            </h2>

            <ol className="mt-4 space-y-1">
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
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
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

function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="text-[13px] font-extrabold text-gray-900">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2.5">{children}</div>
    </div>
  );
}

function Screen({ n }: { n: number }) {
  if (n === 0)
    return (
      <Chrome title="Tonight in Abuja">
        <div className="flex gap-1.5">
          {["Party", "Game Night", "Beach"].map((c, k) => (
            <span
              key={c}
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                k === 0 ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {[
            ["Rooftop sundowner", "Sat · Maitama · Free"],
            ["FIFA night at the crib", "Sat · Wuse 2 · ₦2,000"],
            ["Beach day, Landmark", "Sun · Lagos · ₦5,000"],
          ].map(([t, m]) => (
            <div key={t} className="flex items-center gap-2 rounded-xl border border-gray-100 p-2">
              <span className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-brand-200 to-brand" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-gray-900">{t}</span>
                <span className="block truncate text-[10px] text-gray-500">{m}</span>
              </span>
            </div>
          ))}
        </div>
      </Chrome>
    );

  if (n === 1)
    return (
      <Chrome title="Rooftop sundowner">
        <div className="h-16 rounded-xl bg-gradient-to-br from-brand to-[#1A1040]" />
        <p className="mt-2 text-[11px] leading-snug text-gray-600">
          Hosted by Tobi · 12 going · approval required
        </p>
        <div className="mt-2 rounded-xl bg-brand px-3 py-2 text-center text-[11px] font-bold text-white">
          Request to join
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-naija-50 px-2.5 py-2">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-naija text-[9px] font-black text-white">
            ✓
          </span>
          <span className="text-[10px] font-semibold text-naija-800">
            Request sent — Tobi will approve you
          </span>
        </div>
      </Chrome>
    );

  if (n === 2)
    return (
      <Chrome title="Sundowner group chat">
        <div className="space-y-1.5">
          <Bubble side="left" name="Tobi">Pull up by 6, rooftop is on the 9th floor 🌇</Bubble>
          <Bubble side="left" name="Amaka">Who&apos;s coming from Wuse? Let&apos;s share a ride</Bubble>
          <Bubble side="right" name="You">I&apos;m in Wuse 2, I can pick up 👋</Bubble>
        </div>
      </Chrome>
    );

  return (
    <Chrome title="Bring your paddy">
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
