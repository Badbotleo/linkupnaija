"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";

export default function EventsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeState = searchParams.get("state") ?? "";
  const activeCategory = searchParams.get("category") ?? "";
  const seriesOnly = searchParams.get("series") === "1";

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="state" className="sr-only">
            Filter by state
          </label>
          <select
            id="state"
            value={activeState}
            onChange={(e) => setParam("state", e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">📍 All states</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setParam("series", seriesOnly ? "" : "1")}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              seriesOnly
                ? "border-brand bg-brand text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
            }`}
          >
            🔄 Series only
          </button>
          {(activeState || activeCategory || seriesOnly) && (
            <button
              type="button"
              onClick={() => router.push(pathname, { scroll: false })}
              className="text-sm font-medium text-brand hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip
          label="All vibes"
          active={!activeCategory}
          onClick={() => setParam("category", "")}
          delay={0}
        />
        {EVENT_CATEGORIES.map((cat, i) => (
          <Chip
            key={cat}
            label={cat}
            active={activeCategory === cat}
            onClick={() => setParam("category", cat)}
            delay={(i + 1) * 35}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  delay = 0,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-pop-in rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? "border-brand bg-brand text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
      }`}
    >
      {label}
    </button>
  );
}
