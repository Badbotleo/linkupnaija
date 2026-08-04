"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LineIcon from "../ui/LineIcon";
import { toast } from "@/lib/toast";

interface Pending {
  reservationId: string;
  venueId: string;
  venueName: string;
  date: string;
}

/**
 * Asks for a rating only where one is earned: a confirmed reservation, at a
 * partner venue, on a date that has passed. Anything else — declined, still
 * pending, or an OpenStreetMap spot with no venue row — never appears.
 *
 * The same conditions are enforced by RLS, so this is the prompt, not the
 * gate.
 */
export default function RateVenuePrompt({ userId }: { userId: string }) {
  const supabase = createClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; n: number } | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: rows, error }, { data: mine }] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, venue_id, venue_name, date")
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .not("venue_id", "is", null)
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(10),
      supabase.from("venue_reviews").select("reservation_id").eq("user_id", userId),
    ]);

    // A failed query should leave the card absent, not show an empty prompt.
    if (error) return;

    const reviewed = new Set(
      ((mine ?? []) as { reservation_id: string | null }[])
        .map((r) => r.reservation_id)
        .filter(Boolean)
    );
    setPending(
      ((rows ?? []) as {
        id: string;
        venue_id: string;
        venue_name: string;
        date: string;
      }[])
        .filter((r) => !reviewed.has(r.id))
        .map((r) => ({
          reservationId: r.id,
          venueId: r.venue_id,
          venueName: r.venue_name,
          date: r.date,
        }))
    );
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function rate(p: Pending, stars: number) {
    if (busy) return;
    setBusy(p.reservationId);
    const { error } = await supabase.from("venue_reviews").insert({
      venue_id: p.venueId,
      user_id: userId,
      reservation_id: p.reservationId,
      rating: stars,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Thanks — ${p.venueName} rated ${stars}★`);
    setPending((list) => list.filter((x) => x.reservationId !== p.reservationId));
  }

  if (pending.length === 0) return null;

  return (
    <section className="container-page mt-8">
      <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
        How was it?
      </h2>
      <p className="mt-0.5 text-[13px] text-gray-500">
        Rate the spots you booked so the next person knows what to expect
      </p>

      <div className="mt-3 space-y-2">
        {pending.map((p) => (
          <div
            key={p.reservationId}
            className="flex flex-wrap items-center justify-between gap-3 surface p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-gray-900">{p.venueName}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Booked{" "}
                {new Date(`${p.date}T00:00:00`).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>

            <div
              className="flex shrink-0 items-center gap-0.5"
              onMouseLeave={() => setHover(null)}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const lit =
                  hover?.id === p.reservationId ? n <= hover.n : false;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={busy === p.reservationId}
                    onMouseEnter={() => setHover({ id: p.reservationId, n })}
                    onClick={() => rate(p, n)}
                    aria-label={`Rate ${p.venueName} ${n} out of 5`}
                    className={`rounded-lg p-1 transition disabled:opacity-40 ${
                      lit ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
                    }`}
                  >
                    <LineIcon name="star" size={22} filled={lit} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
