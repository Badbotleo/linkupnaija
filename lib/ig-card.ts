import { ATTENDANCE_REVEAL_AT } from "./social-proof";

/**
 * The data layer behind the Instagram cards.
 *
 * Kept out of the route so the caption and the image are built from exactly
 * the same numbers. A card that says "6 spots left" beside a caption that
 * says "12 going" is worse than either alone, and that drift is guaranteed
 * the moment two files compute it separately.
 */

export const BRAND = {
  bg: "#0F0A2E",
  purple: "#534AB7",
  purpleDark: "#3C3489",
  purpleLight: "#AFA9EC",
  gold: "#FAC775",
  green: "#3BD16F",
  coral: "#FF6B5E",
  white: "#FFFFFF",
} as const;

export type Crop = "feed" | "portrait" | "story";

export const CROPS: Record<Crop, { w: number; h: number }> = {
  feed: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

/**
 * Category gradients, replacing the stock-photo fallback.
 *
 * A stock photo of somebody else's party is a promise the event can't keep,
 * and in a paid ad that's the difference between a click and a complaint. A
 * gradient says "we don't have a photo" honestly and still looks deliberate.
 */
const GRADIENTS: Record<string, [string, string]> = {
  Party: ["#5B21B6", "#DB2777"],
  Concert: ["#7C2D12", "#F59E0B"],
  Clubbing: ["#1E1B4B", "#7C3AED"],
  "Beach Day": ["#0C4A6E", "#06B6D4"],
  "Pool Party": ["#0E7490", "#22D3EE"],
  "Game Night": ["#1E293B", "#6366F1"],
  Dinner: ["#7C2D12", "#C2410C"],
  Karaoke: ["#831843", "#EC4899"],
  Hiking: ["#14532D", "#65A30D"],
  Bowling: ["#312E81", "#4F46E5"],
  Picnic: ["#3F6212", "#84CC16"],
  Vacation: ["#0F766E", "#2DD4BF"],
  Networking: ["#1E3A8A", "#3B82F6"],
};
const DEFAULT_GRADIENT: [string, string] = ["#3C3489", "#534AB7"];

export const gradientFor = (category: string): [string, string] =>
  GRADIENTS[category] ?? DEFAULT_GRADIENT;

/** "Saturday 23 Aug, 10:00am" — one format, image and caption alike. */
export function formatWhen(date: string, time: string | null): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  const day = d.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  if (!time) return day;
  // Postgres returns time as HH:MM:SS. Appending anything to it produces
  // "Invalid Date" — which toLocaleTimeString returns as a *string* rather
  // than throwing, so it renders straight onto the graphic.
  const [h, m] = time.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return day;
  const suffix = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${day}, ${h12}:${m ?? "00"}${suffix}`;
}

export type Urgency = {
  label: string;
  tone: "urgent" | "normal";
} | null;

/**
 * The scarcity block, and when to stay silent.
 *
 * Three states, in priority order: genuinely running out, healthy turnout,
 * or nothing worth saying. The third is the important one — "0 going" on a
 * paid ad actively costs money, and "2 going" is barely better. Below the
 * reveal threshold the block is omitted rather than softened, because an ad
 * has no room for a hedge.
 */
export function urgencyFor(
  going: number,
  capacity: number | null
): Urgency {
  if (capacity && capacity > 0) {
    const left = capacity - going;
    // Under 40% remaining is a real signal. Above it, "68 spots left" reads
    // as an empty room.
    if (left > 0 && left / capacity <= 0.4) {
      return { label: `Only ${left} spot${left === 1 ? "" : "s"} left`, tone: "urgent" };
    }
    if (left <= 0) return { label: "Sold out", tone: "urgent" };
  }
  if (going >= ATTENDANCE_REVEAL_AT) {
    return { label: `${going} going`, tone: "normal" };
  }
  return null;
}

export const priceLabel = (price: number) =>
  price > 0 ? `₦${price.toLocaleString("en-NG")}` : "Free to join";

/**
 * Titles here often open with an emoji, and Satori ships no emoji font, so
 * one renders as a grey blob. Strip leading pictographs from the graphic.
 * Explicit surrogate ranges because tsconfig targets ES5, where \p{...}
 * unicode escapes aren't available.
 */
export const cleanTitle = (raw: string) =>
  (raw ?? "")
    .replace(/^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⯿️‍\s])+/, "")
    .trim();

export interface CardEvent {
  id: string;
  title: string;
  category: string;
  state: string | null;
  location: string | null;
  date: string;
  time: string | null;
  price: number | null;
  description: string | null;
  cover_image_url: string | null;
  max_attendees: number | null;
}

/**
 * The caption, built from the same values as the image.
 *
 * Written to be pasted as-is: no placeholders, no "insert link here". The
 * detail line is the first real sentence of the description, because a
 * caption that only repeats the graphic gives nobody a reason to read it.
 */
export function buildCaption(e: CardEvent, going: number, url: string): string {
  const when = formatWhen(e.date, e.time);
  const venue = e.location ?? "";
  const urgency = urgencyFor(going, e.max_attendees);

  const detail = (e.description ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)[0]
    ?.trim()
    .slice(0, 140);

  const tags = [
    "#LinkUpNaija",
    `#${(e.state ?? "Nigeria").replace(/[^A-Za-z]/g, "")}Events`,
    `#${e.category.replace(/[^A-Za-z]/g, "")}`,
    "#NaijaEvents",
    "#WhatsOnNaija",
  ];

  return [
    cleanTitle(e.title),
    "",
    `📅 ${when}`,
    venue ? `📍 ${venue}` : null,
    `🎟️ ${priceLabel(e.price ?? 0)}`,
    detail ? `\n${detail}` : null,
    urgency?.tone === "urgent" ? `\n⚡ ${urgency.label}` : null,
    `\nRequest to join: ${url}`,
    "",
    tags.join(" "),
  ]
    .filter((l) => l !== null)
    .join("\n");
}
