/**
 * A maps link for an event, from the only location data events carry.
 *
 * Events store a text address and nothing else: no latitude, no longitude,
 * no place id. So there is nothing to drop a pin on without geocoding
 * first, and the Overpass mirrors this app uses for venue search were
 * timing out and serving an expired certificate when this was written. The
 * address goes to the person's own maps app instead, where it is geocoded
 * by somebody whose job that is, alongside their saved places and live
 * traffic.
 *
 * The state is appended only when the address does not already contain it.
 * Hosts type the city in themselves, so doing it unconditionally produced
 * "Café One, Abuja, Abuja, Nigeria". Google forgives that; a person reading
 * the link does not.
 */
export function directionsHref(location: string, state?: string | null): string {
  // "FCT - Abuja" is how the database spells it, not how anybody searches.
  const place = state ? state.replace(/^FCT\s*-\s*/, "").trim() : null;
  const needsPlace =
    !!place && !location.toLowerCase().includes(place.toLowerCase());
  const query = [location, needsPlace ? place : null, "Nigeria"]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
