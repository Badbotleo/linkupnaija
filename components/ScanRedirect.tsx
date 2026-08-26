"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { viewerKey } from "@/lib/viewer-key";
import { LogoMark } from "./Logo";

/**
 * Records a poster scan, then gets out of the way.
 *
 * The recording happens here rather than in VisitRecorder because this screen
 * exists only to be left: VisitRecorder fires on mount for the current path,
 * and racing it against a redirect would sometimes count the scan and
 * sometimes not. Doing it explicitly and then navigating makes the order
 * certain.
 *
 * The redirect is never held up for long. A scan happens on a street with one
 * bar of signal, and somebody staring at a spinner because an analytics call
 * is hanging is a worse outcome than an uncounted poster.
 */
const GIVE_UP_MS = 1200;

export default function ScanRedirect({
  code,
  dest,
}: {
  /** Already validated by the route. Recorded as /p/<code>. */
  code: string;
  dest: string;
}) {
  const router = useRouter();
  // Strict mode mounts effects twice in dev; without this the same scan is
  // recorded twice and the redirect fires twice.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const go = () => router.replace(dest);

    const record = async () => {
      const key = viewerKey();
      if (!key) return;
      const supabase = createClient();
      // Source stays null. The column is documented as a referrer HOST and a
      // scan has no referrer; the path is what identifies this as a poster.
      await supabase.rpc("record_visit", {
        p_key: key,
        p_path: `/p/${code}`,
        p_source: null,
        p_state: null,
      });
    };

    Promise.race([
      record().catch(() => {
        // Before the analytics migration the RPC does not exist. A poster must
        // still take somebody to the events feed.
      }),
      new Promise((r) => setTimeout(r, GIVE_UP_MS)),
    ]).finally(go);
  }, [code, dest, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark size={56} pulse />
      <p className="text-sm font-semibold text-gray-500">Finding link-ups near you…</p>
      {/* A scan that lands on a page with a dead end is worse than a slow one. */}
      <noscript>
        <a href={dest} className="font-bold text-brand underline">
          Continue to LinkUpNaija
        </a>
      </noscript>
    </div>
  );
}
