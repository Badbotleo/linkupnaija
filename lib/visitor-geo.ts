import { headers } from "next/headers";

/**
 * Where the visitor is, from the edge — no permission prompt, no geolocation
 * dialog, nothing for them to accept before the page can decide what to show.
 *
 * Vercel attaches these headers at the edge on every request. Locally they
 * don't exist, so this returns null and callers should treat "unknown" as
 * "don't assume they're nearby".
 *
 * ISO 3166-2:NG region codes are the reliable signal; the city header is only
 * a fallback for the FCT, which shows up inconsistently across providers.
 */
const NG_REGION_TO_STATE: Record<string, string> = {
  AB: "Abia", AD: "Adamawa", AK: "Akwa Ibom", AN: "Anambra", BA: "Bauchi",
  BY: "Bayelsa", BE: "Benue", BO: "Borno", CR: "Cross River", DE: "Delta",
  EB: "Ebonyi", ED: "Edo", EK: "Ekiti", EN: "Enugu", FC: "FCT - Abuja",
  GO: "Gombe", IM: "Imo", JI: "Jigawa", KD: "Kaduna", KN: "Kano",
  KT: "Katsina", KE: "Kebbi", KO: "Kogi", KW: "Kwara", LA: "Lagos",
  NA: "Nasarawa", NI: "Niger", OG: "Ogun", ON: "Ondo", OS: "Osun",
  OY: "Oyo", PL: "Plateau", RI: "Rivers", SO: "Sokoto", TA: "Taraba",
  YO: "Yobe", ZA: "Zamfara",
};

/** The visitor's Nigerian state, or null when we genuinely can't tell. */
export function getVisitorState(): string | null {
  const h = headers();

  // Only trust the region code for Nigerian traffic — "LA" means Lagos here
  // and Louisiana in the US.
  const country = h.get("x-vercel-ip-country");
  if (country && country !== "NG") return null;

  const region = h.get("x-vercel-ip-country-region");
  if (region) {
    const state = NG_REGION_TO_STATE[region.toUpperCase()];
    if (state) return state;
  }

  const city = h.get("x-vercel-ip-city");
  if (city && /abuja/i.test(decodeURIComponent(city))) return "FCT - Abuja";

  return null;
}
