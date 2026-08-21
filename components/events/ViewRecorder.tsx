"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Records one view of an event, once per browser per day.
 *
 * Renders nothing. Fires after paint so it can never delay the page it's
 * measuring — an analytics call that costs the host a slower event page has
 * taken more than it gives.
 *
 * The key is a random id in localStorage: not a user id, not an IP, nothing
 * that identifies anybody. Logged-out visitors are most of the traffic on an
 * event page, and a funnel that only counts signed-in views would tell a host
 * their reach was a tenth of what it is.
 *
 * The host's own views are skipped. Otherwise the first number on the page is
 * partly the host refreshing it.
 */
const KEY = "linkup:vk";

function viewerKey(): string | null {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    // Private mode, or storage disabled. Skip rather than fall back to
    // something fingerprint-ish.
    return null;
  }
}

export default function ViewRecorder({
  eventId,
  isHost,
}: {
  eventId: string;
  isHost: boolean;
}) {
  useEffect(() => {
    if (isHost) return;
    const key = viewerKey();
    if (!key) return;

    const id = window.setTimeout(() => {
      const supabase = createClient();
      supabase
        .rpc("record_event_view", { p_event: eventId, p_key: key })
        // Silent by design. A failed view count must never surface to the
        // person reading the page, and before the migration runs this RPC
        // simply doesn't exist.
        .then(() => {});
    }, 800);

    return () => window.clearTimeout(id);
  }, [eventId, isHost]);

  return null;
}
