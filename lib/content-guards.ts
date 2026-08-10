/**
 * Guards against content that is technically present but says nothing.
 *
 * Every check here exists because something reached production. A required
 * field that only tests `.trim()` is satisfied by "." — and 26 of the 26
 * curated "Things to do" cards were saved with "." as both title and place,
 * which rendered as a shelf of blank cards on the home page. A location field
 * with no length cap absorbed an entire 474-character event description.
 *
 * These run at write time (so it stops happening) and at read time (so the
 * rows already in the database can't render), because fixing only one of
 * those leaves the bug live either in the past or in the future.
 */

/**
 * Longest sane venue/address string.
 *
 * Set from the live data, not from a guess. The longest genuine address in
 * the table is 133 characters ("Reign Restaurant, Arcade/Games Gallery and
 * Event Center, 28 Sapele Road, beside St. Mary's British Dedication School,
 * Benin City, Edo") and the two broken ones are 474 and 485. A tighter cap
 * would have rejected a real venue, which is the worse failure.
 */
export const MAX_LOCATION_LENGTH = 160;

/** Characters that carry no meaning on their own. */
const FILLER = /^[.\s\-–—_,;:*'"`~!?()[\]{}\/\\|+=<>#&@$%^]*$/;

/**
 * True when a string is real content rather than a keystroke used to get past
 * a required-field check. "." , "-", "  " and "" are all rejected; anything
 * with a letter or digit in it passes.
 */
export function isRealText(value: string | null | undefined, min = 2): boolean {
  const s = (value ?? "").trim();
  if (s.length < min) return false;
  // Deliberately not "must contain a latin letter": event titles here carry
  // Yoruba and Igbo diacritics and plenty of emoji, and rejecting real
  // content is a worse failure than letting an emoji-only title through.
  return !FILLER.test(s);
}

/**
 * Validate a location/address. Returns an error message, or null when fine.
 *
 * The length cap is the real point: without one, people paste the whole
 * description into the venue box and the card renders a paragraph where an
 * address should be.
 */
export function validateLocation(value: string): string | null {
  const s = value.trim();
  if (!isRealText(s, 3)) return "Give a real venue or address.";
  if (s.length > MAX_LOCATION_LENGTH)
    return `That looks like a description, not an address. Keep the venue under ${MAX_LOCATION_LENGTH} characters (yours is ${s.length}) and put the details in the description.`;
  return null;
}

/**
 * The identity we use to decide two events are the same listing.
 *
 * Title + date + location, all normalised. Two rows matching on this are a
 * double submit, not two genuine events — nobody runs the same event twice at
 * the same place on the same day under the same name.
 */
export function eventFingerprint(e: {
  title: string | null;
  date: string | null;
  location: string | null;
}): string {
  const norm = (s: string | null) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  return `${norm(e.title)}|${norm(e.date)}|${norm(e.location)}`;
}

/**
 * Collapse duplicate listings, keeping the first of each group.
 *
 * Render-side defence. The database can still hold duplicates (an old double
 * submit, an import run twice) and this makes sure the feed never shows the
 * same event twice while those rows exist.
 */
export function dedupeEvents<
  T extends { title: string | null; date: string | null; location: string | null },
>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    const fp = eventFingerprint(e);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(e);
  }
  return out;
}
