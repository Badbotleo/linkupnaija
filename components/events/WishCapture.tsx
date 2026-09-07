"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LineIcon from "../ui/LineIcon";
import { toast } from "@/lib/toast";

/**
 * The empty search, treated as information rather than an apology.
 *
 * "Nothing for chill rooftop in Lekki" used to offer Clear search and Host it,
 * which asks somebody who wanted to attend a night to go and run one. Most
 * people will do neither, and the thing they told us, in their own words, at
 * the exact moment they wanted it, was thrown away.
 *
 * Two doors instead, in the order of how much they ask of you:
 *
 *   Tell me when one turns up  costs a tap, and leaves a row saying what to
 *                              put on next and who to tell.
 *   Host it yourself           opens the form already carrying their words.
 *
 * The wish is the point. At this size the misses are better demand data than
 * anything else the platform collects, because a search is somebody deciding,
 * not somebody browsing.
 */
export default function WishCapture({
  query,
  category,
  state,
}: {
  query: string;
  category?: string;
  state?: string;
}) {
  const supabase = createClient();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // The host form reads these off the URL and fills itself in.
  const hostParams = new URLSearchParams({ title: query });
  if (category) hostParams.set("category", category);
  if (state) hostParams.set("state", state);

  async function save() {
    if (busy || saved) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Signed out, so send them to log in and come back to this exact
      // search. The wish survives the round trip because it is in the URL.
      if (!user) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          pathname + "?q=" + query
        )}`;
        return;
      }

      const { error } = await supabase.from("event_wishes").insert({
        user_id: user.id,
        query,
        category: category ?? null,
        state: state ?? null,
      });

      // 23505 is the unique index: they have wished for this before, which
      // is a success from where they are standing.
      if (error && error.code !== "23505") {
        toast.error("Couldn't save that. Try again?");
        return;
      }
      setSaved(true);
      toast.success("Noted. We'll tell you when one turns up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={save}
        disabled={busy || saved}
        className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-100"
      >
        <LineIcon name={saved ? "check" : "bell"} size={16} />
        {saved ? "We'll tell you" : "Tell me when one turns up"}
      </button>
      <Link
        href={`/host?${hostParams.toString()}`}
        className="btn-outline inline-flex items-center justify-center gap-2"
      >
        Host it yourself
      </Link>
    </div>
  );
}
