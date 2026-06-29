"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface CompletionItem {
  label: string;
  done: boolean;
}

export default function ProfileCompletion({
  items,
}: {
  items: CompletionItem[];
}) {
  const total = items.length;
  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / total) * 100);

  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const reduced = !!window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setAnimPct(pct);
      return;
    }
    const id = requestAnimationFrame(() => setAnimPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  if (pct >= 100) return null;

  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - animPct / 100);

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle
              cx="42"
              cy="42"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-100"
            />
            <circle
              cx="42"
              cy="42"
              r={R}
              fill="none"
              stroke="#534AB7"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              transform="rotate(-90 42 42)"
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-lg font-extrabold text-brand">
            {animPct}%
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">
            Your profile is {pct}% complete
          </h2>
          <p className="text-sm text-gray-500">
            Complete your profile so hosts trust you and accept you faster.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) =>
              item.done ? (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"
                >
                  <span className="animate-bounce-in" aria-hidden>
                    ✓
                  </span>
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.label}
                  href="/profile/edit"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:border-brand/40 hover:text-brand"
                >
                  + {item.label}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
