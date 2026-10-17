"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import LineIcon from "@/components/ui/LineIcon";
import type { MetPerson } from "@/lib/feed";

/**
 * People you were at a link-up with, in the feed.
 *
 * The same suggestion exists on /friends, and almost nobody opens /friends.
 * Connections are what the friend row on every card, the faces on every
 * circle and half the ranking of this feed are all waiting on, so the ask
 * belongs where people already are rather than behind a tab.
 *
 * ADDS IN PLACE. Sending somebody to a profile to press Add costs a page
 * load and a decision, and the whole point is that this is an easy yes:
 * these are not strangers, you stood in the same room. The row resolves to
 * "Asked" and stays, rather than vanishing, so it is obvious what just
 * happened.
 *
 * Nobody already connected, asked or asking reaches this component. That is
 * filtered server-side against every connection row regardless of status,
 * because suggesting somebody you have already asked is worse than
 * suggesting nobody.
 */
export default function PeopleYouMet({
  people,
  meId,
}: {
  people: MetPerson[];
  meId: string;
}) {
  const supabase = createClient();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  // Removed locally when a row is dismissed, so the card shrinks rather than
  // leaving a gap.
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = people.filter((p) => !hidden.has(p.id));
  if (visible.length === 0) return null;

  async function add(p: MetPerson) {
    setBusy(p.id);
    const { error } = await supabase.from("connections").insert({
      requester_id: meId,
      receiver_id: p.id,
      status: "pending",
    });
    setBusy(null);
    if (error) {
      // A duplicate means the two of you crossed: they asked while this was
      // on screen. Saying "already" is truer than saying it failed.
      toast.error(
        /duplicate|unique/i.test(error.message)
          ? "You two are already connected."
          : "Couldn't send that. Try again."
      );
      return;
    }
    setSent((s) => new Set(s).add(p.id));
    toast.success(`Request sent to ${p.name?.split(" ")[0] ?? "them"}`);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--e1)] dark:bg-white/[0.04]">
      <div className="flex items-center gap-2">
        <LineIcon name="users" size={16} className="shrink-0 text-brand" />
        <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-gray-900 dark:text-white">
          People you were there with
        </h2>
      </div>
      <p className="mt-0.5 text-[13px] text-gray-500">
        Not strangers. You were at the same link-up.
      </p>

      <ul className="mt-3 space-y-1">
        {visible.map((p) => {
          const done = sent.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Link href={`/u/${p.id}`} className="shrink-0">
                <span className="block h-11 w-11 overflow-hidden rounded-full">
                  {p.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <GeneratedAvatar seed={p.id} className="h-full w-full" />
                  )}
                </span>
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${p.id}`}
                  className="block truncate text-[15px] font-bold text-gray-900 hover:text-brand dark:text-white"
                >
                  {p.name ?? "A member"}
                </Link>
                <p className="mt-0.5 truncate text-[13px] text-gray-500">
                  {p.shared > 1
                    ? `${p.shared} link-ups together`
                    : `You were both at ${p.sharedTitle}`}
                </p>
              </div>

              {done ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-4 py-2 text-[13px] font-bold text-gray-500 dark:bg-white/10 dark:text-white/60">
                  Asked
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={busy === p.id}
                    className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
                  >
                    {busy === p.id ? "…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHidden((h) => new Set(h).add(p.id))
                    }
                    aria-label={`Dismiss ${p.name ?? "this person"}`}
                    className="shrink-0 rounded-full p-1.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-white"
                  >
                    <LineIcon name="x" size={15} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <Link
        href="/friends"
        className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-brand hover:underline"
      >
        See everyone you have met
        <LineIcon name="chevronRight" size={13} />
      </Link>
    </section>
  );
}
