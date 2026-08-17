/**
 * The Nigerian flag, drawn rather than typed.
 *
 * 🇳🇬 is a regional-indicator pair, and when a platform can't render that as
 * a colour flag it falls back to a TEXT glyph — which inherits the current
 * text colour. On a dark chip that means a black rectangle where the flag
 * should be, and no chip colour can fix it because the problem isn't the
 * background.
 *
 * Three bars in an SVG always look like the flag, on every platform, in
 * either theme, and the white stripe stays white because it's painted rather
 * than inherited.
 */
export default function NaijaFlag({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={Math.round(size * 1.5)}
      height={size}
      viewBox="0 0 18 12"
      role="img"
      aria-label="Nigeria"
      className={`shrink-0 rounded-[2px] ${className}`}
    >
      <rect width="6" height="12" fill="#008753" />
      <rect x="6" width="6" height="12" fill="#FFFFFF" />
      <rect x="12" width="6" height="12" fill="#008753" />
      {/* A hairline so the white stripe still reads as a stripe against a
          white chip, rather than merging into it. */}
      <rect
        width="18"
        height="12"
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
      />
    </svg>
  );
}
