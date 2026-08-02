import type { Venue } from "./overpass";

/**
 * Onboarded venues and OpenStreetMap results overlap: a place we've signed up
 * is usually already on the map, so it showed up twice — once as a partner
 * card, once as a plain OSM pin.
 *
 * Nothing links the two records (every partner row has osm_id, lat and lng
 * null), so the join has to be by name.
 */

/** Location suffixes and articles that differ between the two sources. */
const NOISE = /\b(abuja|lagos|fct|nigeria|ng|the)\b/g;

export function normaliseVenueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // café → cafe
    .replace(/[''`’]/g, "") // Uncle T's → uncle ts
    .replace(/\([^)]*\)/g, " ") // "Junkyard Grills (Abuja)" → "junkyard grills"
    .replace(NOISE, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Same place? Exact after normalising, or one name contains the other —
 * "Santorini Abuja" and "Santorini Restaurant" are one venue.
 *
 * Deliberately biased toward matching. A false positive shows the partner
 * card, which has the real photo, price and description; a false negative
 * shows the same venue twice, which is the bug we're fixing.
 */
export function sameVenue(a: string, b: string): boolean {
  const x = normaliseVenueName(a);
  const y = normaliseVenueName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Guard against short generic stems matching everything.
  const shorter = x.length <= y.length ? x : y;
  const longer = shorter === x ? y : x;
  return shorter.length >= 5 && longer.includes(shorter);
}

export interface PartnerLike {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Split OSM results against our partner list.
 *
 * Rather than just dropping the duplicate, the partner adopts the OSM
 * coordinates — that's the only way an onboarded venue gets a map pin at all,
 * since we never captured lat/lng when onboarding them.
 */
export function mergePartnersWithOsm<P extends PartnerLike>(
  partners: P[],
  osm: Venue[]
): { osmOnly: Venue[]; located: (P & { lat: number; lng: number })[] } {
  const claimed = new Set<string>();
  const located: (P & { lat: number; lng: number })[] = [];

  for (const p of partners) {
    const hit = osm.find((v) => !claimed.has(v.id) && sameVenue(p.name, v.name));
    if (hit) {
      claimed.add(hit.id);
      located.push({ ...p, lat: p.lat ?? hit.lat, lng: p.lng ?? hit.lng });
    } else if (p.lat != null && p.lng != null) {
      located.push({ ...p, lat: p.lat, lng: p.lng });
    }
  }

  return { osmOnly: osm.filter((v) => !claimed.has(v.id)), located };
}
