"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * The host pulls the names out of the hat.
 *
 * Shown only to the host of an event carrying a raffle tier, and it calls
 * draw_claim_winners(), which re-checks that in the database. The button
 * being hidden is a courtesy; the function is the rule.
 *
 * TOPS UP RATHER THAN RE-DRAWS. The function counts claims already accepted
 * against the draw size, so pressing it a second time fills the gap left by
 * somebody the host declined instead of handing out another ten. That makes
 * this safe to press twice, which matters because the first thing anybody
 * does with a button labelled Draw is press it again to see what happens.
 */
export default function DrawWinners({
  code,
  drawSize,
  claimed,
  drawn,
}: {
  code: string;
  drawSize: number;
  claimed: number;
  drawn: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<{ winner_name: string | null }[] | null>(
    null
  );

  const waiting = Math.max(0, claimed - drawn);
  const left = Math.max(0, drawSize - drawn);

  async function draw() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("draw_claim_winners", {
      p_code: code,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setWinners((data ?? []) as { winner_name: string | null }[]);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-dashed border-brand/40 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-gray-900">
            Giveaway draw
          </p>
          <p className="mt-0.5 text-[13px] text-gray-600">
            {claimed} claimed · {drawn} of {drawSize} drawn
            {left > 0 && waiting > 0 && ` · ${waiting} still in the hat`}
          </p>
        </div>
        <button
          type="button"
          onClick={draw}
          disabled={busy || left === 0 || waiting === 0}
          className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy
            ? "Drawing…"
            : left === 0
              ? "All drawn"
              : waiting === 0
                ? "Nobody waiting"
                : `Draw ${Math.min(left, waiting)}`}
        </button>
      </div>

      {winners && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[13px] leading-snug text-gray-700">
          {winners.length === 0
            ? "Nobody new was drawn."
            : `Drawn: ${winners
                .map((w) => w.winner_name ?? "someone")
                .join(", ")}. They are accepted and owe nothing.`}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}

      <p className="mt-2 text-[12px] leading-snug text-gray-500">
        Weighted by how complete each profile is, so a finished profile is
        about five times likelier to come out than an empty one. You can still
        decline anybody the draw picks.
      </p>
    </div>
  );
}
