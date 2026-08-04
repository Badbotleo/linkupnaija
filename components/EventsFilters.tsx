"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { NIGERIAN_STATES, CATEGORY_STYLES } from "@/lib/constants";
import { CATEGORY_GROUPS, groupForCategory } from "@/lib/category-groups";
import { EVENT_CATEGORIES } from "@/lib/constants";
import LineIcon from "./ui/LineIcon";

export default function EventsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeState = searchParams.get("state") ?? "";
  const activeCategory = searchParams.get("category") ?? "";
  const seriesOnly = searchParams.get("series") === "1";

  // Which family of vibes is expanded. Defaults to the one holding the
  // current filter, so a shared link opens showing where you are.
  const [catQuery, setCatQuery] = useState("");
  const [open, setOpen] = useState<string | null>(
    activeCategory ? groupForCategory(activeCategory)?.key ?? null : null
  );

  const setParams = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const filtered = activeState || activeCategory || seriesOnly;

  return (
    <div className="space-y-4">
      <VibeSearch onPick={setParams} />

      {/* ---- state + toggles row ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="state" className="sr-only">
          Filter by state
        </label>
        <select
          id="state"
          value={activeState}
          onChange={(e) => setParams({ state: e.target.value })}
          className="cursor-pointer rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-gray-700 transition hover:border-brand/40 focus:border-brand focus:outline-none"
        >
          <option value="">📍 All states</option>
          {NIGERIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setParams({ series: seriesOnly ? "" : "1" })}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
            seriesOnly
              ? "border-brand bg-brand text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
          }`}
        >
          🔄 Series only
        </button>

        {activeCategory && (
          <button
            type="button"
            onClick={() => setParams({ category: "" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-white"
          >
            {CATEGORY_STYLES[activeCategory as keyof typeof CATEGORY_STYLES]?.emoji}{" "}
            {activeCategory}
            <span aria-hidden className="text-[15px] leading-none">×</span>
            <span className="sr-only">Clear category filter</span>
          </button>
        )}

        {filtered && (
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="text-sm font-semibold text-brand hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ---- vibe families ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORY_GROUPS.map((g) => {
          const holdsActive = groupForCategory(activeCategory)?.key === g.key;
          const expanded = open === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setOpen(expanded ? null : g.key)}
              aria-expanded={expanded}
              className={`flex items-center gap-2.5 rounded-2xl border bg-gradient-to-br p-3 text-left transition ${g.tint} ${
                holdsActive || expanded
                  ? "border-brand/50 shadow-card"
                  : "border-transparent hover:border-brand/25"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70 text-base sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg">
                {g.emoji}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-extrabold sm:text-[13px]">
                  {g.label}
                </span>
                <span className="block truncate text-[11px] opacity-70">
                  {g.hint}
                </span>
              </span>
              {/* The chevron is the first thing to go on a narrow phone —
                  it costs more width than it earns next to the label. */}
              <LineIcon
                name="chevronRight"
                size={13}
                className={`ml-auto hidden shrink-0 transition sm:block ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          );
        })}
      </div>

      {/* ---- the chosen family's categories ---- */}
      {open && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
          {/* 54 vibes is too many to scroll past. Typing searches ALL of them,
              not just the open family — nobody knows in advance that Karaoke
              lives under "Live & stage". */}
          <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <LineIcon name="search" size={15} className="shrink-0 text-gray-400" />
            <input
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="Search all vibes…"
              aria-label="Search vibes"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            {catQuery && (
              <button
                type="button"
                onClick={() => setCatQuery("")}
                aria-label="Clear vibe search"
                className="shrink-0 text-gray-400 hover:text-gray-700"
              >
                <span aria-hidden className="text-[15px] leading-none">×</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
          {(catQuery.trim()
            ? EVENT_CATEGORIES.filter((c) =>
                c.toLowerCase().includes(catQuery.trim().toLowerCase())
              )
            : CATEGORY_GROUPS.find((g) => g.key === open)!.categories
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setParams({ category: activeCategory === cat ? "" : cat })
              }
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                activeCategory === cat
                  ? "border-brand bg-brand text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:text-brand"
              }`}
            >
              {CATEGORY_STYLES[cat]?.emoji} {cat}
            </button>
          ))}
          </div>
          {catQuery.trim() &&
            EVENT_CATEGORIES.filter((c) =>
              c.toLowerCase().includes(catQuery.trim().toLowerCase())
            ).length === 0 && (
              <p className="px-1 py-2 text-sm text-gray-500">
                No vibe matches &ldquo;{catQuery.trim()}&rdquo;.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Describe the night you want; we set the filters.                    */
/* ------------------------------------------------------------------ */

function VibeSearch({
  onPick,
}: {
  onPick: (next: Record<string, string>) => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vibe-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "That didn't work. Try again?");
        return;
      }
      setMsg(data.note || null);
      if (data.category || data.state) {
        onPick({ category: data.category ?? "", state: data.state ?? "" });
      }
    } catch {
      // A dead network shouldn't look like a broken feature.
      setMsg("You're offline — pick a vibe below instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={run}>
      <div className="flex items-center gap-2 rounded-2xl border border-brand/25 bg-gradient-to-r from-brand-50 via-white to-naija-50 p-1.5 pl-3.5 focus-within:border-brand">
        <span aria-hidden className="text-base">
          ✨
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe your vibe…"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Match me"}
        </button>
      </div>
      {msg && (
        <p className="mt-1.5 pl-1 text-[13px] font-medium text-gray-600">{msg}</p>
      )}
    </form>
  );
}
