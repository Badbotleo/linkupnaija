/**
 * Brand marks for the socials.
 *
 * LineIcon is deliberately a brand-free stroke set, so a camera glyph was
 * standing in for Instagram. That reads as "photos", not as "their
 * Instagram", and people scan for the logo they know rather than the label
 * beside it.
 *
 * Filled paths, inheriting currentColor, so they sit in the same buttons as
 * everything else.
 */
const PATHS: Record<string, string> = {
  instagram:
    "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.19a6.65 6.65 0 1 0 0 13.3 6.65 6.65 0 0 0 0-13.3zm0 10.97a4.32 4.32 0 1 1 0-8.64 4.32 4.32 0 0 1 0 8.64zm8.46-11.23a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0z",
  tiktok:
    "M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06v-3.1a5.62 5.62 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15V8.99a7.35 7.35 0 0 0 4.3 1.38V7.28a4.32 4.32 0 0 1-3.24-1.46z",
  x: "M17.53 3h3.02l-6.6 7.54L21.75 21h-6.08l-4.76-6.22L5.46 21H2.44l7.06-8.07L2.25 3h6.24l4.3 5.69L17.53 3zm-1.06 16.2h1.67L7.6 4.7H5.81l10.66 14.5z",
  facebook:
    "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z",
};

export default function BrandIcon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const d = PATHS[name];
  // Unknown name renders nothing rather than an empty box, the same way a
  // missing LineIcon should.
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
