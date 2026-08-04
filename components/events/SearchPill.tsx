"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LineIcon from "../ui/LineIcon";

/**
 * The search bar, at the top where people look for it.
 *
 * It used to sit halfway down the page inside the results list, which meant
 * scrolling past the filters to find it. Pinterest opens with one big pill and
 * nothing else competing — this is that, in our colours.
 *
 * Submits to ?q= so a search is a real, shareable, back-buttonable URL rather
 * than throwaway client state.
 */
export default function SearchPill() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);

  // Keep in step when the URL changes underneath us (back button, chip click).
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    const term = q.trim();
    if (term) next.set("q", term);
    else next.delete("q");
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    input.current?.blur();
  }

  function clear() {
    setQ("");
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
          placeholder="Search link-ups, vibes, places…"
          aria-label="Search link-ups"
          // Safari draws its own clear button on type=search and it collides
          // with ours.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q && (
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
    </form>
  );
}
