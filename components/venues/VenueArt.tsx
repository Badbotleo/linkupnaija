import { artHash, artInitials, artPalette } from "@/lib/generated-art";

/**
 * Cover art for a venue that hasn't given us a photo.
 *
 * The stock pool before this was two images per category picked by hash, which
 * falls apart in a grid: the same nightclub interior under three different
 * names, every one of them visibly somewhere else. That is worse than no
 * photo, because it quietly says the listing isn't real.
 *
 * What replaced it was a colour wash with an oversized faded category emoji
 * behind it. Unique per venue, but it said nothing — a decoration, and one
 * that looked like it came from a different product than the circle tiles.
 *
 * So it's drawn as what a venue actually is: a place, pinned on a street.
 * Roads cross the tile, a block or two sits between them, and the pin marks
 * the spot. Same palette set, hash and monogram as CircleArt — a circle is
 * people joined to each other, a venue is somewhere you go. Same hand,
 * different subject.
 *
 * A venue with a genuine photo should still show it. This is the fallback.
 */
export default function VenueArt({
  name,
  category,
  className = "",
}: {
  name: string;
  category: string;
  className?: string;
}) {
  // Category is in the seed so two branches of the same chain that happen to
  // be listed differently don't come out identical.
  const seed = `${name}::${category}`;
  const h = artHash(seed);
  const [deep, mid, light] = artPalette(seed);

  // The pin sits off-centre. Dead centre reads as a target rather than a map,
  // and these tiles are cropped wide and short so the middle band is all that
  // survives anyway.
  const px = 34 + (h % 32);
  const py = 42 + ((h >> 5) % 16);

  // Two roads each way, angled apart so the grid never looks like graph
  // paper, plus one wider main road through the pin.
  const skewA = ((h >> 9) % 24) - 12;
  const skewB = ((h >> 13) % 24) - 12;
  const roadY1 = 22 + ((h >> 17) % 18);
  const roadY2 = 62 + ((h >> 19) % 16);
  const roadX1 = 18 + ((h >> 21) % 22);
  const roadX2 = 58 + ((h >> 23) % 24);

  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`} style={{ background: deep }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id={`vglow-${h}`} cx={`${px}%`} cy={`${py}%`} r="72%">
            <stop offset="0%" stopColor={mid} stopOpacity="0.95" />
            <stop offset="100%" stopColor={deep} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100" height="100" fill={`url(#vglow-${h})`} />

        {/* City blocks. Faint, so they read as ground rather than as shapes. */}
        <g fill={light} fillOpacity="0.06">
          <rect x={roadX1 + 4} y={roadY1 + 4} width={roadX2 - roadX1 - 8} height={roadY2 - roadY1 - 8} />
          <rect x={roadX2 + 5} y={roadY1 + 4} width="30" height={roadY2 - roadY1 - 8} />
        </g>

        {/* Side streets. */}
        <g stroke={light} strokeOpacity="0.22" strokeWidth="1.1" strokeLinecap="round">
          <line x1="-10" y1={roadY1} x2="110" y2={roadY1 + skewA} />
          <line x1="-10" y1={roadY2} x2="110" y2={roadY2 + skewB} />
          <line x1={roadX1} y1="-10" x2={roadX1 + skewB} y2="110" />
          <line x1={roadX2} y1="-10" x2={roadX2 + skewA} y2="110" />
        </g>

        {/* The main road, running through the pin so the eye lands there. */}
        <line
          x1="-10"
          y1={py + 6 - skewA / 2}
          x2="110"
          y2={py + 6 + skewA / 2}
          stroke={light}
          strokeOpacity="0.4"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* The pin. The one element that isn't texture. */}
        <g transform={`translate(${px} ${py})`}>
          <circle r="9" fill={light} fillOpacity="0.16" />
          <path
            d="M0 6 C -4.6 -0.6 -6.4 -3.2 -6.4 -5.6 A 6.4 6.4 0 0 1 6.4 -5.6 C 6.4 -3.2 4.6 -0.6 0 6 Z"
            fill={light}
          />
          <circle cy="-5.6" r="2.3" fill={deep} />
        </g>
      </svg>

      <span
        className="absolute bottom-2 left-3 select-none text-[13px] font-black tracking-[0.18em] text-white/70"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
      >
        {artInitials(name)}
      </span>
    </div>
  );
}
