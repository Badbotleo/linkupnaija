/**
 * The shared grammar for drawn cover art.
 *
 * Circles and venues both need a cover when nobody has uploaded a photo, and
 * both were solving it separately: a venue got a colour wash with an oversized
 * faded emoji behind it, which is decoration rather than information, and it
 * looked like it came from a different product than the circle tiles.
 *
 * One palette set, one hash, one monogram rule. What differs between them is
 * the SUBJECT, which is the part that should differ: a circle is people joined
 * to each other, a venue is a place on a map. Same hand, different drawing.
 */

/**
 * Deep, mid, light. Deep grounds the tile, light draws on it.
 *
 * Fourteen, not eight. Six circles on one screen were landing on four
 * palettes, so two pairs of tiles read as the same picture — hash-mod-N
 * collides far more often than it feels like it should, which is the birthday
 * problem and not bad luck. Widening the set makes a visible clash unlikely
 * rather than routine.
 *
 * Hues are spread around the wheel deliberately. Two greens a few degrees
 * apart are a collision to the eye even when the code thinks they differ.
 */
export const ART_PALETTES: [string, string, string][] = [
  ["#1A1040", "#534AB7", "#AFA9EC"], // brand night
  ["#06231F", "#008753", "#7FE3B4"], // naija green
  ["#2A1206", "#C2620F", "#FFC98A"], // ember
  ["#25062B", "#9A2BA0", "#F0A8F5"], // orchid
  ["#04212E", "#0E7490", "#8CE0F0"], // deep water
  ["#2B0A18", "#B3255F", "#FFA8C6"], // hibiscus
  ["#1B2405", "#5E8C10", "#CBEB84"], // palm
  ["#301A03", "#966A16", "#FAC775"], // brand gold
  ["#0B1733", "#1D4ED8", "#93C5FD"], // royal
  ["#2D0A0A", "#B91C1C", "#FCA5A5"], // crimson
  ["#101A2B", "#4B5F7A", "#CBD5E1"], // slate
  ["#032620", "#0F766E", "#5EEAD4"], // teal
  ["#1E0B33", "#6D28D9", "#C4B5FD"], // violet
  ["#2B1B02", "#A16207", "#FDE68A"], // brass
];

/** FNV-1a. Stable across renders and servers, which a random seed is not. */
export function artHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * The palette is hashed from a DIFFERENT string than the geometry.
 *
 * Using one hash for both meant colour and layout moved together: two names
 * that collided on palette tended to look alike in every other way too,
 * because every varying number came from the same bits. Salting the seed
 * decorrelates them, so a shared palette still gets a visibly different
 * drawing.
 */
export function artPalette(seed: string): [string, string, string] {
  return ART_PALETTES[artHash(`${seed}#palette`) % ART_PALETTES.length];
}

/**
 * Up to two initials, so a tile still says which thing it is.
 *
 * No \p{L} escape: tsconfig targets ES5 and the u flag is a compile error.
 * Stripping per word rather than up front also means a name that opens with
 * an emoji, which many do, gives its first LETTER instead of a blank.
 */
export function artInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, "").charAt(0))
    .filter(Boolean);
  if (letters.length === 0) return "•";
  return (letters[0] + (letters[1] ?? "")).toUpperCase();
}
