/**
 * The anonymous per-browser id that every count on the site is keyed on.
 *
 * Lived inside VisitRecorder until the poster redirect needed it too. It is
 * shared on purpose: site_visits and event_views both dedupe on this key, so
 * somebody who scans a poster and then browses has to look like one visitor
 * and not two. A second copy of this logic would eventually drift and quietly
 * split people in half.
 *
 * It is not a user id and not an IP. Nothing here says who anybody is.
 */
const KEY = "linkup:vk";

export function viewerKey(): string | null {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    // Private mode or storage blocked. Skip rather than reach for anything
    // that would identify the person instead.
    return null;
  }
}
