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
 * So it's drawn, and it's drawn as what a circle actually is: people joined
 * to each other. Three arrangements — a hub, a chain, two clusters meeting —
 * chosen per circle, because varying only the numbers left every tile reading
 * as "a glowing dot with lines" and two sharing a palette looked identical.
 * Arrangement, palette and jitter are hashed from separate salts so they do
 * not move together. Nothing is downloaded.
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

  // Three arrangements, not one set of jiggled parameters.
  //
  // Every tile used to be a hub with spokes, so at this crop they all read as
  // "a glowing dot with lines" and two sharing a palette looked like the same
  // picture. Varying the numbers was never going to fix that; the composition
  // itself has to differ. Which one a circle gets is hashed separately from
  // both the palette and the jitter, so colour and layout do not move
  // together.
  const mode = artHash(`${name}#mode`) % 3;

  // How many people are in the drawing. Real membership, so the art carries
  // one true fact, capped so a big circle stays legible.
  const count = Math.max(4, Math.min(8, 3 + Math.floor(Math.max(0, members) / 3)));

  const cx = 50 + (((h >> 11) % 14) - 7);
  const cy = 50 + (((h >> 17) % 8) - 4);

  const bits = (i: number) => (h >> (i * 3 + 5)) & 0xff;

  let points: { x: number; y: number; r: number }[];
  let links: { x1: number; y1: number; x2: number; y2: number }[];

  if (mode === 0) {
    // Hub and spokes: everyone joined to a centre.
    const spin = ((h >> 3) % 360) * (Math.PI / 180);
    points = Array.from({ length: count }, (_, i) => {
      const b = bits(i);
      const angle = spin + (i / count) * Math.PI * 2 + ((b % 40) - 20) / 100;
      const radius = 30 + (b % 17);
      // Squashed flat: these covers are short and wide, and a square viewBox
      // with slice keeps only the middle band, so a true ring puts most nodes
      // off-canvas and leaves lines running to nowhere.
      return { x: 50 + Math.cos(angle) * radius * 1.9, y: 50 + Math.sin(angle) * radius * 0.42, r: 3.4 + ((b >> 4) % 5) * 0.75 };
    });
    links = points.map((p2) => ({ x1: cx, y1: cy, x2: p2.x, y2: p2.y }));
  } else if (mode === 1) {
    // A chain: one person to the next, a thread rather than a wheel.
    points = Array.from({ length: count }, (_, i) => {
      const b = bits(i);
      const step = 100 / (count - 1);
      return { x: -6 + i * (step * 1.12), y: 34 + (b % 32), r: 3.2 + ((b >> 4) % 5) * 0.7 };
    });
    links = points.slice(1).map((p2, i) => ({ x1: points[i].x, y1: points[i].y, x2: p2.x, y2: p2.y }));
  } else {
    // Two clusters joined: groups that met. The join is the whole point, so
    // it is the only long line on the tile.
    const half = Math.ceil(count / 2);
    const hubs = [
      { x: 24 + ((h >> 7) % 10), y: 42 + ((h >> 9) % 12) },
      { x: 66 + ((h >> 13) % 12), y: 44 + ((h >> 15) % 12) },
    ];
    points = Array.from({ length: count }, (_, i) => {
      const b = bits(i);
      const hub = hubs[i < half ? 0 : 1];
      const angle = ((b % 360) * Math.PI) / 180;
      const radius = 9 + (b % 12);
      return { x: hub.x + Math.cos(angle) * radius * 1.5, y: hub.y + Math.sin(angle) * radius * 0.5, r: 3 + ((b >> 4) % 4) * 0.8 };
    });
    links = points.map((p2, i) => {
      const hub = hubs[i < half ? 0 : 1];
      return { x1: hub.x, y1: hub.y, x2: p2.x, y2: p2.y };
    });
    links.push({ x1: hubs[0].x, y1: hubs[0].y, x2: hubs[1].x, y2: hubs[1].y });
  }

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

        {/* Whatever the arrangement joined up. Never a mesh of everyone to
            everyone, which just fills in as noise at this size. */}
        <g stroke={light} strokeOpacity="0.35" strokeWidth="0.5">
          {links.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>

        <g fill={light}>
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fillOpacity={0.55 + ((h >> i) & 3) * 0.15} />
          ))}
        </g>

        {mode === 0 && (
          <>
            <circle cx={cx} cy={cy} r="7" fill={light} fillOpacity="0.18" />
            <circle cx={cx} cy={cy} r="4.2" fill={light} fillOpacity="0.9" />
          </>
        )}
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
