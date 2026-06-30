// Shared config for QR codes across LinkUpNaija.

export const QR_BRAND = "#534AB7";

// Canonical production origin — used for print/marketing QR codes (/qr,
// tournament, opportunities) so a scanned flyer always points at the live site,
// regardless of the environment the page was rendered in.
export const SITE_ORIGIN = "https://linkupnaija.com";

// The LinkUpNaija pin mark on a white badge, as an SVG data URI. Sits in the
// centre of a QR code (excavated, ~20% width → ~4% area, well within the safe
// limit for scannability). A data URI keeps the canvas untainted so it can be
// exported to PNG.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<circle cx="24" cy="24" r="24" fill="#ffffff"/>
<circle cx="24" cy="24" r="20" fill="#534AB7"/>
<circle cx="24" cy="24" r="15" fill="#3C3489"/>
<circle cx="24" cy="16.5" r="4" fill="#AFA9EC"/>
<path d="M16.5 30c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="#AFA9EC"/>
<circle cx="14.5" cy="23" r="3.3" fill="#ffffff"/>
<path d="M8.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#ffffff"/>
<circle cx="33.5" cy="23" r="3.3" fill="#ffffff"/>
<path d="M27.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" fill="#ffffff"/>
</svg>`;

export const QR_LOGO_SRC = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;
