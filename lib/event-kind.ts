import type { EventCategory } from "./constants";

/**
 * HANGOUTS vs PROFESSIONAL — what the default feed is for.
 *
 * The homepage promises "house parties, beach days, game nights and raves".
 * The feed was delivering HR roundtables, health conferences, real estate
 * summits and national security summits. Of 53 upcoming events, 19 were
 * category "Networking" and every one of them was a conference, summit, expo
 * or trade fair. Someone arriving from that promise met a professional events
 * board, and left.
 *
 * DERIVED, NOT STORED — and deliberately so.
 *
 * There is no `event_kind` column. The category taxonomy already answers this
 * question, so a column would mean a migration, a backfill of 83 rows, a new
 * field on the host form, and a second source of truth that drifts the first
 * time somebody inserts a row without it. Deriving costs one function.
 *
 * It also means there is nothing to backfill: every existing event is already
 * classified, and every category added later is classified the moment it is
 * assigned to a group — which lib/category-groups.ts already forces at build
 * time.
 *
 * The trade-off, stated plainly: a miscategorised event lands in the wrong
 * feed and the only fix is to correct its category. That is the right lever
 * anyway — an event filed under "Networking" that is really a beach party is
 * wrong on the card, in search and in the vibe filters too, not just here.
 */

export type EventKind = "hangout" | "professional";

/**
 * Categories that belong to work, not to a night out.
 *
 * Listed explicitly rather than taken wholesale from the "Meet & grow" group,
 * because that group is a mix. "Singles Meetup", "Alumni Meetup", "Faith
 * Gathering" and "Community & Social" sit in it and are exactly the sort of
 * thing the default feed should keep — people go to those with friends, not
 * with a lanyard.
 */
const PROFESSIONAL_LIST: readonly EventCategory[] = [
  "Networking",
  "Conference",
  "Seminar",
  "Workshop",
  "Masterclass",
  "Career Fair",
  "Business Meetup",
  "Startup / Pitch Night",
  "Tech Meetup",
  "Coding / Tech Class",
  "Skill Training",
  "Mentorship",
  "Study Abroad",
  "Market / Trade Fair",
  "Product Launch",
] as const;

export const PROFESSIONAL_CATEGORIES: ReadonlySet<string> = new Set<string>(
  PROFESSIONAL_LIST
);

/**
 * Which feed an event belongs in.
 *
 * `is_corporate` wins over the category: a company that books a corporate
 * package has said what the event is more directly than its category does.
 */
export function eventKind(event: {
  category: string;
  is_corporate?: boolean | null;
}): EventKind {
  if (event.is_corporate) return "professional";
  return PROFESSIONAL_CATEGORIES.has(event.category) ? "professional" : "hangout";
}

export function isHangout(event: {
  category: string;
  is_corporate?: boolean | null;
}): boolean {
  return eventKind(event) === "hangout";
}

/**
 * Filter a list to one kind.
 *
 * Returns everything unchanged when `kind` is null — used for the paths where
 * the viewer has asked for something specific and the default must not apply
 * (see shouldFilterByKind).
 */
export function filterByKind<T extends { category: string; is_corporate?: boolean | null }>(
  events: T[],
  kind: EventKind | null
): T[] {
  if (!kind) return events;
  return events.filter((e) => eventKind(e) === kind);
}

/**
 * The category list as a PostgREST `in` value, e.g. `("Networking","Seminar")`.
 *
 * The kind is derived rather than stored, but it still has to be applied in
 * SQL rather than after the fetch: the feed is paginated with an exact count,
 * and filtering a page after it arrives gives short pages and a wrong total.
 * Values are quoted because several categories contain spaces and slashes.
 */
export function professionalCategoriesFilter(): string {
  const quoted = PROFESSIONAL_LIST.map((c) => `"${c}"`).join(",");
  return `(${quoted})`;
}

/**
 * Whether the hangouts-only default should apply at all.
 *
 * It must not when the viewer has asked for something specific — picking the
 * "Networking" category or searching "conference" is an explicit request, and
 * silently returning nothing would look broken. An explicit filter always
 * beats the default.
 */
export function shouldFilterByKind(params: {
  category?: string;
  q?: string;
  tab?: string;
}): boolean {
  if (params.category) return false;
  if (params.q?.trim()) return false;
  return true;
}
