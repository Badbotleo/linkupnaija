"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

/**
 * "Interested" — the rung below asking to join.
 *
 * DELIBERATELY SECONDARY. It sits under the join button, in outline rather
 * than fill, because the risk with a cheap action next to an expensive one is
 * that it eats it: somebody who would have requested taps this instead and
 * calls it done. Keeping it visually subordinate is half the mitigation. The
 * other half is that interest is treated as a queue to convert rather than an
 * end state, which is what the reminder 48 hours out is for.
 *
 * It does NOT appear once you are in. Somebody who has been accepted has no
 * use for "interested", and showing it would read as though their spot was
 * not real.
 *
 * Logged out, it is a link to sign in rather than a button that fails. The
 * count is still shown, because a number is the part that works without an
 * account.
 */
export default function InterestButton({
  eventId,
  initialInterested,
  initialCount,
  isLoggedIn,
  hasRequested,
  isHost = false,
}: {
  eventId: string;
  initialInterested: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  hasRequested: boolean;
  isHost?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [on, setOn] = useState(initialInterested);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  /**
   * The host gets the number, never the button and never the names.
   *
   * This is the signal the host has never had. With no requests they could
   * not tell "nobody saw it" from "nobody wanted it", and those two call for
   * opposite responses. Eleven interested and no requests means the event is
   * fine and the asking is the problem; nought and nought means nobody is
   * looking.
   *
   * Names are deliberately withheld. Interest is private, which is what makes
   * it cheap enough to give, and a host who could see the list would be
   * looking at people who have not agreed to be seen.
   */
  if (isHost) {
    if (count === 0) return null;
    return (
      <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 py-2.5 text-[14px] font-semibold text-gray-600 dark:bg-white/5 dark:text-white/70">
        <LineIcon name="star" size={15} />
        {count} {count === 1 ? "person is" : "people are"} interested but have
        not asked yet
      </p>
    );
  }

  // Already in, or already asked. Nothing to express.
  if (hasRequested) return null;

  const label = count > 0 ? `Interested · ${count}` : "Interested";

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=/events/${eventId}`}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 py-3 text-[15px] font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:text-white/80"
      >
        <LineIcon name="star" size={17} />
        {label}
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }

    // Optimistic, then corrected if the write fails. Tapping a star should
    // feel instant; it is the cheapest action on the page and a spinner on it
    // would make it feel like the expensive one.
    const next = !on;
    setOn(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    const { error } = next
      ? await supabase
          .from("event_interest")
          .insert({ event_id: eventId, user_id: user.id })
      : await supabase
          .from("event_interest")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);

    setBusy(false);

    if (error) {
      setOn(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      // 42P01 is "table does not exist", which means the migration has not run
      // yet. Worth saying plainly rather than "something went wrong".
      toast.error(
        error.code === "42P01"
          ? "Not available yet."
          : "Couldn't save that. Try again."
      );
      return;
    }

    if (next) toast.success("Saved. We'll remind you before it starts.");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full border py-3 text-[15px] font-bold transition disabled:opacity-60 ${
        on
          ? "border-brand/40 bg-brand/10 text-brand"
          : "border-gray-200 text-gray-700 hover:border-brand/40 hover:text-brand dark:border-white/15 dark:text-white/80"
      }`}
    >
      <LineIcon name="star" size={17} />
      {on ? `Interested · ${count}` : label}
    </button>
  );
}
