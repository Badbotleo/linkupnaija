import { artHash, artInitials, artPalette } from "@/lib/generated-art";

/**
 * Cover art for a circle that hasn't uploaded a photo.
 *
 * Circles were falling back to EventCover, which paints the category
 * gradient — so every Book Club in the country was the same amber rectangle
 * and the grid read as a settings page rather than a room full of people.
 * A stock photo is worse again: a picture of somebody else's friends, three
 * times on one screen.
 *
 * So it's drawn, and it's drawn as what a circle actually is: a small
 * constellation of people joined to each other. Node positions, palette and
 * jitter all come from the circle's own name, so a circle is always itself
 * and two neighbours are reliably different. Nothing is downloaded.
 *
 * A circle with a real photo still shows it. This is the fallback.
 */

export default function CircleArt({
  name,
  members = 0,
  className = "",
}: {
  name: string;
  /** More people, more nodes. Caps out so a big circle stays legible. */
  members?: number;
  className?: string;
}) {
  const h = artHash(name);
  const [deep, mid, light] = artPalette(name);

  // Five to eight people in the constellation. Reading the real membership
  // means the art carries one true fact about the circle rather than being
  // pure decoration.
  const nodes = Math.max(5, Math.min(8, 4 + Math.floor(Math.max(0, members) / 4)));

  // The ring is deliberately lopsided. A perfect circle of evenly spaced dots
  // is a loading spinner; the jitter is what makes it read as people.
  const spin = ((h >> 3) % 360) * (Math.PI / 180);
  const points = Array.from({ length: nodes }, (_, i) => {
    const bits = (h >> (i * 3 + 5)) & 0xff;
    const angle = spin + (i / nodes) * Math.PI * 2 + ((bits % 40) - 20) / 100;
    const radius = 30 + (bits % 17);
    // Wide and flat, not a ring.
    //
    // These covers are short and wide, and a square viewBox with slice keeps
    // only the middle horizontal band — so a true circle of nodes put most of
    // them off-canvas and left a sunburst of lines running to nowhere. The
    // ring is squashed onto the strip that actually survives every crop this
    // is used at, from h-28 in the grid to h-48 on the circle page.
    return {
      x: 50 + Math.cos(angle) * radius * 1.9,
      y: 50 + Math.sin(angle) * radius * 0.42,
      r: 3.4 + ((bits >> 4) % 5) * 0.75,
    };
  });

  const cx = 50 + (((h >> 11) % 14) - 7);
  const cy = 50 + (((h >> 17) % 8) - 4);

  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`} style={{ background: deep }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id={`glow-${h}`} cx={`${cx}%`} cy={`${cy}%`} r="70%">
            <stop offset="0%" stopColor={mid} stopOpacity="0.95" />
            <stop offset="100%" stopColor={deep} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100" height="100" fill={`url(#glow-${h})`} />

        {/* Every line from the middle out. A circle is people joined to a
            centre, not a mesh of everyone to everyone, which just fills in as
            noise at this size. */}
        <g stroke={light} strokeOpacity="0.35" strokeWidth="0.5">
          {points.map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} />
          ))}
        </g>

        <g fill={light}>
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fillOpacity={0.55 + ((h >> i) & 3) * 0.15} />
          ))}
        </g>

        <circle cx={cx} cy={cy} r="7" fill={light} fillOpacity="0.18" />
        <circle cx={cx} cy={cy} r="4.2" fill={light} fillOpacity="0.9" />
      </svg>

      {/* The monogram, bottom-left and quiet. Big centred initials would be a
          placeholder avatar; down here it reads as a mark on artwork. */}
      <span
        className="absolute bottom-2 left-3 select-none text-[13px] font-black tracking-[0.18em] text-white/70"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
      >
        {artInitials(name)}
      </span>
    </div>
  );
}
