"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { CATEGORY_STYLES } from "@/lib/constants";
import { CATEGORY_GROUPS, groupForCategory } from "@/lib/category-groups";
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
  const [open, setOpen] = useState<string | null>(
    activeCategory ? groupForCategory(activeCategory)?.key ?? null : null
  );
  const openGroup = open
    ? CATEGORY_GROUPS.find((g) => g.key === open) ?? null
    : null;

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
      {/* VibeSearch ("Describe your vibe" → an LLM sets the filters) used to
          lead this block. It is still in this file and still works, but it sat
          directly under the panel's own search pill, whose placeholder already
          reads "Search link-ups, vibes, places". Two search boxes stacked, one
          of which quietly rewrites your filters, is most of the confusion this
          panel was meant to remove. Search it, pick a vibe, or open the map:
          three ways to look again, each visibly a different kind of thing. */}

      {/* ---- state + toggles row ---- */}
      {/* The state dropdown that used to lead this row is gone. The header
          pill names the city and opens StatePicker, so this was the second
          state control on the page and the two could disagree on sight. */}
      <div className="flex flex-wrap items-center gap-2">
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
        {CATEGORY_GROUPS.map((g, i) => {
          const holdsActive = groupForCategory(activeCategory)?.key === g.key;
          const expanded = open === g.key;
          // Nine families divide evenly into the three columns used from sm
          // up, but leave the last one stranded beside a gap in the two
          // columns a phone gets. It stretches to fill the row instead, which
          // reads as the end of the list rather than a missing tile.
          //
          // Tied to the count, not hardcoded: add a tenth family and the two
          // column layout is even again, so this switches itself off.
          const fillsRow =
            i === CATEGORY_GROUPS.length - 1 && CATEGORY_GROUPS.length % 2 === 1;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setOpen(expanded ? null : g.key)}
              aria-expanded={expanded}
              className={`flex items-center gap-2.5 rounded-2xl border bg-gradient-to-br p-3 text-left transition ${g.tint} ${
                fillsRow ? "col-span-2 sm:col-span-1" : ""
              } ${
                holdsActive || expanded
                  ? "border-brand/50 shadow-card"
                  : "border-transparent hover:border-brand/25"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70 text-base sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg">
                {g.emoji}
              </span>
              <span className="min-w-0">
                {/* Wraps rather than truncates. Two columns on a 375px phone
                    left roughly 110px for the label, which rendered the list
                    as "Food & dri…", "Games & s…", "Meet & gro…". A filter you
                    cannot read the name of is not a filter. The hint below it
                    still truncates, because that line is a nicety. */}
                <span className="block text-[12.5px] font-extrabold leading-tight sm:text-[13px]">
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
      {openGroup && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          {/* Says which family you opened, and how to leave.
              Before this the panel had no header and no close: the only exit
              was tapping the same tile again, nine tiles up, which nobody
              guesses. It also opened with its own "Search all vibes" box, so
              choosing a vibe presented a third search field under the two
              already on the page. The families exist precisely so that 54
              categories do not need searching. */}
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-gray-900 dark:text-white">
              <span aria-hidden>{openGroup.emoji}</span>
              <span className="truncate">{openGroup.label}</span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[13px] font-bold text-gray-600 transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:bg-transparent dark:text-white/70"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {openGroup.categories.map((cat) => (
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
