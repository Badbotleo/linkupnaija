/**
 * Makes a cover URL safe for Satori, which renders the OG and Instagram cards.
 *
 * Satori decodes PNG, JPEG and SVG. It does not decode WebP — it fails
 * silently and leaves the space empty, which is why 13 of 79 upcoming events
 * were producing an Instagram card with a black rectangle where the flyer
 * should be. Nothing in the logs, nothing in the response: a 200 and a
 * picture of nothing.
 *
 * Supabase Storage can transcode on the way out. Swapping /object/public/ for
 * /render/image/public/ returns JPEG regardless of what was uploaded, so a
 * host can keep uploading whatever their phone produces.
 *
 * Resizing to 1080 at the same time is free: it's the exact width the card
 * needs, and the originals are routinely several megabytes.
 *
 * URLs we don't recognise are returned untouched — a stock category photo is
 * already a JPEG in /public, and a third-party URL is not ours to rewrite.
 */
export function ogImageSrc(url: string | null | undefined, width = 1080): string | null {
  if (!url) return null;
  if (!url.includes("/storage/v1/object/public/")) return url;

  const transformed = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=80`;
}
