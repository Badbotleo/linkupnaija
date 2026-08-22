/**
 * Which states have enough happening to stand on their own.
 *
 * 70% of the audience is in Lagos and 16% in Abuja; between them they hold
 * 56 of the 69 upcoming events. Everywhere else has five or fewer, and most
 * states have none at all.
 *
 * So a Lagos visitor should see Lagos — showing them an Abuja party is
 * showing them something they cannot attend, and it was the single most
 * common thing in the feed. But applying the same rule in Plateau, where 20
 * people share zero events, would hand them an empty app.
 *
 * Hence the split: dense states scope to themselves, everywhere else sees the
 * country. Add a state here once it can carry a feed on its own.
 */
export const DENSE_STATES: readonly string[] = ["Lagos", "FCT - Abuja"];

export function isDenseState(state: string | null | undefined): boolean {
  return !!state && DENSE_STATES.includes(state);
}

/**
 * The state to scope a feed to, or null for "show everything".
 *
 * An explicit choice always wins: someone who picked a state from the filter,
 * or searched, has asked for something specific, and quietly overriding that
 * is how a filter comes to look broken.
 */
export function scopeState(opts: {
  visitorState?: string | null;
  explicitState?: string | null;
  query?: string | null;
  /** ?scope=all — the viewer asked to see the whole country. */
  showAll?: boolean;
}): string | null {
  if (opts.showAll) return null;
  if (opts.explicitState) return null; // already filtered by the caller
  if (opts.query?.trim()) return null; // a search reaches the whole country
  return isDenseState(opts.visitorState) ? opts.visitorState! : null;
}
