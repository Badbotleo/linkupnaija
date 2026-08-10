import type { NigerianState } from "./constants";

/**
 * "Near me" for a country with 36 states and a capital territory.
 *
 * The honest alternative is per-state coordinates and a distance calculation,
 * but that buys precision we can't use: we're ordering a shelf of ideas, not
 * routing a car. Nigeria's six geopolitical zones are the grouping people
 * already think in, they're stable, and someone in Ogun genuinely does treat
 * a Lagos idea as local in a way they don't treat one in Yobe.
 *
 * Used to answer "show me what's near me, and if there's nothing here, show
 * me the closest thing" without ever showing an empty page.
 */

export type Zone =
  | "North Central"
  | "North East"
  | "North West"
  | "South East"
  | "South South"
  | "South West";

export const STATE_ZONE: Record<NigerianState, Zone> = {
  // North Central — plus the FCT, which sits inside it.
  Benue: "North Central",
  Kogi: "North Central",
  Kwara: "North Central",
  Nasarawa: "North Central",
  Niger: "North Central",
  Plateau: "North Central",
  "FCT - Abuja": "North Central",

  // North East
  Adamawa: "North East",
  Bauchi: "North East",
  Borno: "North East",
  Gombe: "North East",
  Taraba: "North East",
  Yobe: "North East",

  // North West
  Jigawa: "North West",
  Kaduna: "North West",
  Kano: "North West",
  Katsina: "North West",
  Kebbi: "North West",
  Sokoto: "North West",
  Zamfara: "North West",

  // South East
  Abia: "South East",
  Anambra: "South East",
  Ebonyi: "South East",
  Enugu: "South East",
  Imo: "South East",

  // South South
  "Akwa Ibom": "South South",
  Bayelsa: "South South",
  "Cross River": "South South",
  Delta: "South South",
  Edo: "South South",
  Rivers: "South South",

  // South West
  Ekiti: "South West",
  Lagos: "South West",
  Ogun: "South West",
  Ondo: "South West",
  Osun: "South West",
  Oyo: "South West",
};

export function zoneOf(state: string | null | undefined): Zone | null {
  if (!state) return null;
  return STATE_ZONE[state as NigerianState] ?? null;
}

/**
 * How far another state is from `from`, lower being closer.
 *
 * 0 = the same state, 1 = the same zone, 2 = anywhere else, 3 = no state at
 * all. Nationwide items sort last rather than being dropped: an idea with no
 * state attached is usable everywhere, it's just not evidence of anything
 * local.
 */
export function proximity(
  from: string | null | undefined,
  to: string | null | undefined
): number {
  if (!to) return 3;
  if (!from) return 2;
  if (from === to) return 0;
  const a = zoneOf(from);
  const b = zoneOf(to);
  if (a && b && a === b) return 1;
  return 2;
}

/**
 * Order a list nearest-first, keeping the original order within each band.
 *
 * Sorting rather than filtering is the point: filtering to one state empties
 * the page for anyone outside Lagos and Abuja, which is most people. This
 * puts their own state first, then their zone, then everywhere else — so
 * there is always something to look at and the nearest thing always leads.
 */
export function byProximity<T>(
  items: T[],
  from: string | null | undefined,
  stateOf: (item: T) => string | null | undefined
): T[] {
  return items
    .map((item, i) => ({ item, i, d: proximity(from, stateOf(item)) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.item);
}
