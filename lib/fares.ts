// Fare estimation for ride requests.
//
// These are ESTIMATES shown before a request is sent — the operator confirms
// the real fare afterwards. Straight-line distance underestimates road
// distance, so it's padded by a routing factor rather than quoted raw.

export interface VehicleClass {
  key: "Sedan" | "SUV" | "Bus" | "Luxury";
  label: string;
  icon: string;
  seats: string;
  blurb: string;
  base: number; // ₦ pickup charge
  perKm: number; // ₦ per km
  minFare: number; // ₦ floor
  etaMins: number; // typical wait
}

export const VEHICLE_CLASSES: VehicleClass[] = [
  { key: "Sedan",  label: "Sedan",  icon: "car",   seats: "1–4",  blurb: "Everyday runs",        base: 700,  perKm: 250, minFare: 1500, etaMins: 4 },
  { key: "SUV",    label: "SUV",    icon: "car",   seats: "1–6",  blurb: "More room, bad roads", base: 1200, perKm: 380, minFare: 2500, etaMins: 6 },
  { key: "Bus",    label: "Bus",    icon: "users", seats: "7–30", blurb: "Move the whole squad", base: 3000, perKm: 520, minFare: 6000, etaMins: 12 },
  { key: "Luxury", label: "Luxury", icon: "star",  seats: "1–4",  blurb: "Arrive in style",      base: 2500, perKm: 700, minFare: 8000, etaMins: 9 },
];

/** Roads are never straight — pad great-circle distance to something realistic. */
export const ROUTE_FACTOR = 1.35;

export function estimateFare(v: VehicleClass, straightLineKm: number): number {
  const km = straightLineKm * ROUTE_FACTOR;
  const raw = v.base + km * v.perKm;
  // Round to the nearest ₦50 so quotes don't read like false precision.
  return Math.max(v.minFare, Math.round(raw / 50) * 50);
}

/** Rough trip time: city average ~22km/h plus a few minutes of faff. */
export function estimateMinutes(straightLineKm: number): number {
  return Math.max(5, Math.round((straightLineKm * ROUTE_FACTOR) / 22 * 60) + 4);
}

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
