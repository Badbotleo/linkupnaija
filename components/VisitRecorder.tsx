"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { viewerKey } from "@/lib/viewer-key";

/**
 * Counts a visit, once per browser per page per day.
 *
 * Renders nothing and fires after paint, so it can never slow the page it is
 * measuring. Errors are swallowed on purpose: before the migration runs the
 * RPC does not exist, and a missing analytics call must never surface to
 * somebody trying to read the site.
 *
 * The key is the same random localStorage id event_views uses, so a person
 * who browses the home page and then opens an event counts as one visitor
 * rather than two. It is not a user id and not an IP — nothing here says who
 * anybody is.
 *
 * Paths are normalised before they leave the browser. /events/<uuid> becomes
 * /events/:id, or the top-pages list is a hundred rows of one visit each.
 */
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function normalise(path: string): string {
  return path.replace(UUID, ":id").split("?")[0].slice(0, 200) || "/";
}

/**
 * The referrer host that started this session.
 *
 * Captured once and kept, because after the first click document.referrer is
 * our own domain — record it per page and every visitor's source becomes
 * "linkupnaija.com", which is both useless and wrong.
 *
 * Host only. A full referrer can carry a search query, a private group's
 * path, or a session id somebody pasted; the host is the whole useful signal
 * and none of the risk.
 */
const SOURCE_KEY = "linkup:src";

function sessionSource(): string | null {
  try {
    const kept = sessionStorage.getItem(SOURCE_KEY);
    if (kept !== null) return kept || null;

    let host = "";
    if (document.referrer) {
      try {
        const h = new URL(document.referrer).hostname.replace(/^www\./, "");
        // Our own pages aren't a source.
        if (h && h !== window.location.hostname.replace(/^www\./, "")) host = h;
      } catch {
        /* malformed referrer — treat as direct */
      }
    }
    sessionStorage.setItem(SOURCE_KEY, host);
    return host || null;
  } catch {
    return null;
  }
}

export default function VisitRecorder({ state }: { state?: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    // Admin pages are us, not visitors, and counting our own tab inflates
    // exactly the number we would use to judge whether anything is working.
    if (!pathname || pathname.startsWith("/admin")) return;

    const key = viewerKey();
    if (!key) return;

    const path = normalise(pathname);

    // Skip the round trip entirely if this browser already logged this page
    // today. The unique index would reject it anyway; this saves the request.
    const seenKey = `linkup:v:${path}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(seenKey)) return;
    } catch {
      /* storage blocked — fall through and let the index dedupe */
    }

    const id = window.setTimeout(() => {
      createClient()
        .rpc("record_visit", {
          p_key: key,
          p_path: path,
          p_source: sessionSource(),
          p_state: state ?? null,
        })
        .then(() => {
          try {
            sessionStorage.setItem(seenKey, "1");
          } catch {}
        });
    }, 900);

    return () => window.clearTimeout(id);
  }, [pathname, state]);

  return null;
}
