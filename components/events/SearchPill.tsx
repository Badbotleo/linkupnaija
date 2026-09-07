"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LineIcon from "../ui/LineIcon";

/**
 * The search bar, at the top where people look for it, and it understands
 * plain English.
 *
 * Two boxes used to do this job. This one matched words against titles, and a
 * second "Describe your vibe" box below it sent the text to an LLM that set
 * the filters. Stacking them was confusing enough that the AI one was pulled
 * out of the layout, which left the good half of the feature switched off and
 * the browsing wall of vibe tiles doing all the work.
 *
 * One box is the answer, not two. Type "somewhere chill in Abuja this
 * weekend" and it reads the intent, sets the filters and says what it did.
 * Type "Klub Tempo" and it stays a keyword search. Nobody has to know which
 * kind of thing they typed.
 *
 * Submits to the URL either way, so a search is real, shareable and
 * back-buttonable rather than throwaway client state.
 */
export default function SearchPill() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Keep in step when the URL changes underneath us (back button, chip click).
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function go(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    input.current?.blur();
    setNote(null);

    if (!term) {
      const next = new URLSearchParams(params.toString());
      next.delete("q");
      go(next);
      return;
    }

    // The keyword search runs first and unconditionally. Whatever the matcher
    // decides, results are already on screen: an LLM call must never be the
    // thing standing between somebody and their search.
    const keyword = new URLSearchParams(params.toString());
    keyword.set("q", term);
    go(keyword);

    setBusy(true);
    try {
      const res = await fetch("/api/vibe-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: term }),
      });
      const data = await res.json();

      // Only a description gets converted. "Klub Tempo" is a real link-up on
      // this site, and the matcher reads it as Clubbing: swapping the words
      // for that filter would bury the exact event somebody just named. The
      // route calls the tie for "name" so an ambiguous string keeps its
      // keyword search, which is the recoverable mistake of the two.
      if (res.ok && data.kind === "vibe" && (data.category || data.state)) {
        const next = new URLSearchParams(params.toString());
        next.delete("q");
        if (data.category) next.set("category", data.category);
        else next.delete("category");
        if (data.state) next.set("state", data.state);
        go(next);
        setNote(data.note || null);
      }
      // Everything else, including the key being unset in production, leaves
      // the keyword results exactly where they are. A silent fallback beats
      // an error message about a feature nobody asked for by name.
    } catch {
      // Offline. The keyword search already ran against the page it has.
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setQ("");
    setNote(null);
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    go(next);
  }

  return (
    <form onSubmit={submit} role="search">
      <div className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-5 py-3.5 shadow-card transition focus-within:border-brand focus-within:shadow-lg">
        <LineIcon name="search" size={20} className="shrink-0 text-gray-400" />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Says what it accepts. "Search link-ups, vibes, places" described a
          // keyword box; this invites the sentence people actually have in
          // their head.
          placeholder="Somewhere chill in Abuja this weekend…"
          aria-label="Search link-ups, or describe the vibe you want"
          // Safari draws its own clear button on type=search and it collides
          // with ours.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {busy && (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-brand"
            aria-label="Reading your vibe"
          />
        )}
        {!busy && q && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800"
          >
            <span aria-hidden className="text-[15px] leading-none">×</span>
          </button>
        )}
      </div>

      {/* What it understood, in its own words. Without this the filters change
          on their own and the page looks like it did something random. */}
      {note && (
        <p
          aria-live="polite"
          className="mt-2 flex items-center gap-1.5 pl-2 text-[13px] font-medium text-gray-600 dark:text-white/70"
        >
          <span aria-hidden>✨</span>
          {note}
        </p>
      )}
    </form>
  );
}
