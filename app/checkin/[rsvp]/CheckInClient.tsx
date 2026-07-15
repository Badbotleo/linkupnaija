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

// Runs the check-in the moment the host's scan opens this page.
export default function CheckInClient({ rsvpId }: { rsvpId: string }) {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "done">("loading");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("check_in_attendee", {
        p_rsvp: rsvpId,
      });
      if (error) setResult({ ok: false, error: error.message });
      else setResult(data as Result);
      setState("done");
    })();
  }, [rsvpId, supabase]);

  return (
    <div className="container-page grid min-h-[70vh] max-w-md place-items-center py-10">
      <div className="w-full rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
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
