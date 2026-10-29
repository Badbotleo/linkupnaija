"use server";

import { revalidateTag } from "next/cache";
import { RECAPS_TAG } from "@/lib/recaps";

/**
 * Clear the home-page recap shelf's cache.
 *
 * WHY THIS EXISTS. The admin writes recaps straight from the browser to
 * Supabase, which is fine for the write but means no server ever learns that
 * the data changed. The shelf is wrapped in unstable_cache with a 300s
 * window, so a freshly uploaded recap was invisible on the home page for up
 * to five minutes with nothing in the interface able to hurry it along. The
 * only tell was that waiting eventually worked, which is the worst kind of
 * bug to diagnose.
 *
 * WHY AN ACTION RATHER THAN A ROUTE. revalidateTag only exists server side.
 * A server action is the smallest way to reach it from a client component,
 * with no endpoint to secure, no payload to validate, and nothing that does
 * anything if called: clearing a public cache is not a privileged operation,
 * so there is no authorisation check to forget here.
 *
 * The event's OWN page does not need this. getRecapsForEvent is uncached and
 * those pages are force-dynamic, so a recap appears there immediately. Only
 * the home shelf was ever stale.
 */
export async function refreshRecaps(): Promise<void> {
  revalidateTag(RECAPS_TAG);
}
