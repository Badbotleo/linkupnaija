/**
 * The LinkUpNaija mark as a standalone SVG, for images generated outside React
 * — Open Graph cards, the Instagram square, anything built with next/og.
 *
 * Those run through Satori, which can't render the <LogoMark> component, so
 * the shape has to exist as markup too. Keep this in sync with
 * components/Logo.tsx — it is the same emblem: a purple disc, a lavender
 * centre person, and two white people flanking them.
 *
 * Encoded with encodeURIComponent rather than Buffer so it stays usable
 * anywhere, not just in a Node runtime.
 */
export const LOGO_MARK_SVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" fill="#534AB7"/><circle cx="24" cy="24" r="16.5" fill="#3C3489"/><circle cx="24" cy="16.5" r="4" fill="#AFA9EC"/><path d="M16.5 30c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="#AFA9EC"/><circle cx="14.5" cy="23" r="3.3" fill="#FFFFFF"/><path d="M8.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF"/><circle cx="33.5" cy="23" r="3.3" fill="#FFFFFF"/><path d="M27.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#FFFFFF"/></svg>`;

export const LOGO_MARK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  LOGO_MARK_SVG
)}`;
