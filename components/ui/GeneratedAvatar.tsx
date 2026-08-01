/**
 * A drawn avatar for people who haven't uploaded a photo yet — so host
 * rankings and attendee lists read as a room of people rather than a column
 * of purple initials.
 *
 * NOT Apple Memoji: those are Apple's own artwork, only generated on Apple
 * devices, and not licensable for a website. These are drawn here from scratch
 * and rendered as inline SVG — no library, no network request, no tracking
 * pixel, and identical every time for the same person.
 *
 * The palette is built for a Nigerian audience: the skin tones are the range
 * our users actually have, not a generic default.
 */

const SKIN = ["#8D5524", "#7A4520", "#5C3317", "#A9713B", "#6B3E1E"];
const HAIR = ["#1B1210", "#2B1B12", "#3A2317", "#1A1040"];
const BG = ["#EDEBFA", "#E6F4ED", "#FDF2E3", "#FBE9EF", "#E7F0FB", "#F3ECFB"];

// Simple, stable string hash — the same name always draws the same face.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Style = 0 | 1 | 2 | 3 | 4 | 5;

export default function GeneratedAvatar({
  seed,
  className = "",
}: {
  /** Anything stable per person — a user id is better than a name. */
  seed: string;
  className?: string;
}) {
  const h = hash(seed || "linkupnaija");
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const bg = BG[(h >> 6) % BG.length];
  const style = ((h >> 9) % 6) as Style;
  const shirt = ["#534AB7", "#008753", "#FAC775", "#1A1040"][(h >> 12) % 4];

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-hidden
      focusable="false"
    >
      <rect width="64" height="64" fill={bg} />

      {/* shoulders */}
      <path d="M6 64c0-13 11.6-19 26-19s26 6 26 19z" fill={shirt} />

      {/* neck */}
      <rect x="27" y="38" width="10" height="10" rx="4" fill={skin} />

      {/* head */}
      <ellipse cx="32" cy="27" rx="14" ry="15.5" fill={skin} />

      {/* ears */}
      <ellipse cx="18" cy="28" rx="2.6" ry="3.4" fill={skin} />
      <ellipse cx="46" cy="28" rx="2.6" ry="3.4" fill={skin} />

      <Hair style={style} hair={hair} />

      {/* eyes */}
      <ellipse cx="26.5" cy="27" rx="1.7" ry="2" fill="#20160F" />
      <ellipse cx="37.5" cy="27" rx="1.7" ry="2" fill="#20160F" />

      {/* brows */}
      <path
        d="M23.5 22.6q3-1.6 6 0M34.5 22.6q3-1.6 6 0"
        stroke={hair}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* smile */}
      <path
        d="M27 34.5q5 3.6 10 0"
        stroke="#3A2317"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Six hairstyles — enough that a list of ten people doesn't visibly repeat. */
function Hair({ style, hair }: { style: Style; hair: string }) {
  switch (style) {
    case 0: // close cut
      return <path d="M18 24q1-13 14-13t14 13q-4-6-14-6t-14 6z" fill={hair} />;
    case 1: // afro
      return (
        <>
          <ellipse cx="32" cy="17" rx="17" ry="12" fill={hair} />
          <ellipse cx="32" cy="24" rx="14" ry="7" fill={hair} />
        </>
      );
    case 2: // braids / locs falling past the ears
      return (
        <>
          <path d="M18 25q0-14 14-14t14 14q-4-7-14-7t-14 7z" fill={hair} />
          <rect x="15.5" y="22" width="4" height="18" rx="2" fill={hair} />
          <rect x="44.5" y="22" width="4" height="18" rx="2" fill={hair} />
        </>
      );
    case 3: // headwrap / gele
      return (
        <path
          d="M17 24q0-14 15-14t15 14q-2-4-8-4-5-5-14-2-5 1-8 6z"
          fill={hair}
        />
      );
    case 4: // high top
      return (
        <>
          <path d="M19 24q0-11 13-11t13 11q-4-5-13-5t-13 5z" fill={hair} />
          <rect x="22" y="7" width="20" height="9" rx="4.5" fill={hair} />
        </>
      );
    default: // bun
      return (
        <>
          <path d="M18 25q0-14 14-14t14 14q-4-7-14-7t-14 7z" fill={hair} />
          <circle cx="32" cy="8" r="5" fill={hair} />
        </>
      );
  }
}
