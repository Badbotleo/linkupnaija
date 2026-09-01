"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Result {
  ok: boolean;
  name?: string;
  title?: string;
  already?: boolean;
  error?: string;
}

/** What they bought, so the door knows what to hand over. */
interface Tier {
  name: string;
  admits: number | null;
  description: string | null;
}

// Runs the check-in the moment the host's scan opens this page.
export default function CheckInClient({ rsvpId }: { rsvpId: string }) {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "done">("loading");
  const [result, setResult] = useState<Result | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("check_in_attendee", {
        p_rsvp: rsvpId,
      });
      if (error) setResult({ ok: false, error: error.message });
      else setResult(data as Result);
      setState("done");

      // Read separately rather than from the RPC. "Checked in" and "which
      // package" are different questions, and a failure here must not stop
      // somebody getting through the door.
      const { data: row } = await supabase
        .from("rsvps")
        .select("ticket_tiers(name, admits, description)")
        .eq("id", rsvpId)
        .maybeSingle();
      const t = (row as { ticket_tiers?: Tier | null } | null)?.ticket_tiers;
      if (t) setTier(t);
    })();
  }, [rsvpId, supabase]);

  return (
    <div className="container-page grid min-h-[70vh] max-w-md place-items-center py-10">
      <div className="w-full rounded-2xl bg-white p-8 text-center shadow-card">
        {state === "loading" ? (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand/30 border-t-brand" />
            <p className="mt-4 text-gray-500">Checking in…</p>
          </>
        ) : result?.ok ? (
          <>
            <p className="text-6xl">{result.already ? "✅" : "🎉"}</p>
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
              {result.name} is in!
            </h1>
            <p className="mt-1 text-gray-600">
              {result.already
                ? "Already checked in for"
                : "Checked in for"}{" "}
              <span className="font-semibold">{result.title}</span>
            </p>
            {/* The whole reason for this screen on a multi-tier event: a
                Gold Table and a Combo Lite look identical without it. */}
            {tier && (
              <div className="mt-5 rounded-2xl border-2 border-brand bg-brand-50 p-4 text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand">
                  Package
                </p>
                <p className="mt-0.5 text-xl font-extrabold text-gray-900">
                  {tier.name}
                  {!!tier.admits && (
                    <span className="ml-2 text-sm font-bold text-gray-500">
                      {tier.admits} {tier.admits === 1 ? "person" : "people"}
                    </span>
                  )}
                </p>
                {tier.description && (
                  <p className="mt-1.5 text-sm leading-snug text-gray-600">
                    {tier.description}
                  </p>
                )}
              </div>
            )}

            <p className="mt-6 text-sm text-gray-400">
              Scan the next guest&apos;s ticket to check them in.
            </p>
          </>
        ) : (
          <>
            <p className="text-6xl">🚫</p>
            <h1 className="mt-4 text-xl font-extrabold text-gray-900">
              Couldn&apos;t check in
            </h1>
            <p className="mt-1 text-gray-600">
              {result?.error ?? "Something went wrong."}
            </p>
            <Link href="/dashboard" className="btn-outline mt-6">
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
