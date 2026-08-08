import { MARK_SHAPES } from "./logo-svg";
// Shared config for QR codes across LinkUpNaija.

export const QR_BRAND = "#534AB7";

// Canonical production origin — used for print/marketing QR codes (/qr,
// tournament, opportunities) so a scanned flyer always points at the live site,
// regardless of the environment the page was rendered in.
export const SITE_ORIGIN = "https://www.linkupnaija.com";

// The LinkUpNaija pin mark on a white badge, as an SVG data URI. Sits in the
// centre of a QR code (excavated, ~20% width → ~4% area, well within the safe
// limit for scannability). A data URI keeps the canvas untainted so it can be
// exported to PNG.
// The mark is scaled to 0.91 so it clears the white backing disc that keeps
// it legible inside the QR pattern.
const MARK_SCALED =
  `<g transform="translate(24 24) scale(0.91) translate(-24 -24)">${MARK_SHAPES}</g>`;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<circle cx="24" cy="24" r="24" fill="#ffffff"/>
${MARK_SCALED}
</svg>`;

export const QR_LOGO_SRC = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;
