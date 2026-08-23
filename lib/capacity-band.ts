/**
 * How big a room is, without saying how empty it is.
 *
 * The rest of the app hides small attendance numbers, because "2 going" reads
 * as a warning. That works but it also says nothing — a stranger learns
 * neither that it's intimate nor that it's a thousand people.
 *
 * A band answers the question from the host's own capacity instead of from
 * the RSVP count, so it's true from the moment a listing is created and never
 * exposes that nobody has joined yet. Tikkets does the same thing and it's the
 * better idea: precision here is the enemy.
 */
export const BANDS: readonly { max: number; label: string }[] = [
  { max: 20, label: "Under 20" },
  { max: 50, label: "20–50" },
  { max: 100, label: "50–100" },
  { max: 500, label: "100–500" },
  { max: Infinity, label: "500+" },
];

/**
 * Null when the host set no capacity. An unbounded event is a real choice —
 * inventing "500+" for it would be a claim we can't support.
 */
export function capacityBand(max: number | null | undefined): string | null {
  if (!max || max <= 0) return null;
  return BANDS.find((b) => max <= b.max)?.label ?? null;
}
