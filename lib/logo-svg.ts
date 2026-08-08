/**
 * THE LINKUPNAIJA MARK — the single source of truth.
 *
 * Three people in a circle: a lavender centre figure sitting highest, flanked
 * by two wider white figures that overlap its body, all three landing on a
 * common baseline.
 *
 * It used to be hand-copied into four files — Logo.tsx, appIcon.tsx, qr.ts and
 * here — which meant four versions that drifted apart and none of which matched
 * the real artwork. Everything now derives from PARTS below. Change it here and
 * the app, the app icon, the share cards and the QR codes all follow.
 */

/** Geometry on a 48×48 canvas, in paint order (centre figure sits behind). */
export const MARK = {
  outer: { cx: 24, cy: 24, r: 22, fill: "#534AB7" },
  inner: { cx: 24, cy: 24, r: 17.6, fill: "#3C3489" },
  centreHead: { cx: 24, cy: 17.4, r: 5.1, fill: "#AFA9EC" },
  centreBody: { d: "M17.3 32v-2.4a6.7 6.7 0 0 1 13.4 0V32z", fill: "#AFA9EC" },
  leftHead: { cx: 13.9, cy: 21.6, r: 4.5, fill: "#FFFFFF" },
  leftBody: { d: "M7.9 32v-2a6 6 0 0 1 12 0v2z", fill: "#FFFFFF" },
  rightHead: { cx: 34.1, cy: 21.6, r: 4.5, fill: "#FFFFFF" },
  rightBody: { d: "M28.1 32v-2a6 6 0 0 1 12 0v2z", fill: "#FFFFFF" },
} as const;

/** The mark's inner markup, without the wrapping <svg>. */
export const MARK_SHAPES =
  `<circle cx="${MARK.outer.cx}" cy="${MARK.outer.cy}" r="${MARK.outer.r}" fill="${MARK.outer.fill}"/>` +
  `<circle cx="${MARK.inner.cx}" cy="${MARK.inner.cy}" r="${MARK.inner.r}" fill="${MARK.inner.fill}"/>` +
  `<circle cx="${MARK.centreHead.cx}" cy="${MARK.centreHead.cy}" r="${MARK.centreHead.r}" fill="${MARK.centreHead.fill}"/>` +
  `<path d="${MARK.centreBody.d}" fill="${MARK.centreBody.fill}"/>` +
  `<circle cx="${MARK.leftHead.cx}" cy="${MARK.leftHead.cy}" r="${MARK.leftHead.r}" fill="${MARK.leftHead.fill}"/>` +
  `<path d="${MARK.leftBody.d}" fill="${MARK.leftBody.fill}"/>` +
  `<circle cx="${MARK.rightHead.cx}" cy="${MARK.rightHead.cy}" r="${MARK.rightHead.r}" fill="${MARK.rightHead.fill}"/>` +
  `<path d="${MARK.rightBody.d}" fill="${MARK.rightBody.fill}"/>`;

/** Standalone SVG, for anything that can't render the React component. */
export const LOGO_MARK_SVG =
  `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">${MARK_SHAPES}</svg>`;

/**
 * Encoded with encodeURIComponent rather than Buffer so it works in any
 * runtime — next/og renders this in the Instagram and Open Graph cards.
 */
export const LOGO_MARK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  LOGO_MARK_SVG
)}`;
