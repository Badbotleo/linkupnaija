import { VENUE_CATEGORIES } from "@/lib/overpass";

/**
 * Cover art for a venue that hasn't given us a photo.
 *
 * The stock pool was two images per category, picked by hash. It survives a
 * glance and falls apart in a grid: scroll far enough and the same nightclub
 * interior turns up three times under three different names, and every one of
 * them is visibly a photo of somewhere else. That's worse than no photo — it
 * quietly tells you the listing isn't real.
 *
 * This is drawn instead. The palette is hashed from the venue's own name, so
 * a venue is always the same colour and two neighbours are reliably different;
 * the category's glyph sits behind as a watermark, and a soft radial gives it
 * depth so it doesn't read as a flat colour swatch. It looks deliberate, it's
 * unique per venue, and it downloads nothing — which matters when the covers
 * were a real share of the egress bill.
 *
 * A venue with a genuine photo should still show it. This is the fallback,
 * not the replacement.
 */

// Deep enough that white text sits comfortably on top without a heavy scrim.
const PALETTES: [string, string][] = [
  ["#3B2E8F", "#6D5FD6"], // brand purple
  ["#0B4F4A", "#12857C"], // deep teal
  ["#7A3E06", "#C9800F"], // burnt amber
  ["#701438", "#B8306B"], // wine
  ["#12306E", "#2E63C4"], // indigo
  ["#2C4A0C", "#5E9418"], // olive
  ["#5A1A1A", "#A33A32"], // clay
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const glyphFor = (category: string) =>
  VENUE_CATEGORIES.find((c) => c.key === category)?.emoji ?? "📍";

export default function VenueArt({
  name,
  category,
  className = "",
}: {
  name: string;
  category: string;
  className?: string;
}) {
  const h = hash(name);
  const [from, to] = PALETTES[h % PALETTES.length];
  // Two more bits of the same hash move the highlight around, so venues that
  // land on the same palette still don't look like the same tile.
  const cx = 20 + ((h >> 3) % 60);
  const cy = 15 + ((h >> 7) % 45);

  return (
    <div
      aria-hidden
      className={`overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(circle at ${cx}% ${cy}%, ${to}, ${from} 70%)`,
      }}
    >
      {/* The category mark, oversized and low-contrast — texture rather than
          an icon you're meant to read. Rotated so it doesn't sit like a stamp,
          and pushed off-centre so the caption never lands on top of it. */}
      <span
        className="pointer-events-none absolute -right-3 -top-4 select-none text-[86px] leading-none opacity-[0.13] blur-[0.4px]"
        style={{ transform: "rotate(-12deg)" }}
      >
        {glyphFor(category)}
      </span>
      {/* A single diagonal sheen. Without it the radial reads as flat colour
          at card size. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 42%)",
        }}
      />
    </div>
  );
}
