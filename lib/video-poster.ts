/**
 * Grab a still frame from a video, to use as its poster.
 *
 * A card with no poster is black until enough video has arrived to paint a
 * frame. A poster is one small JPEG that appears immediately, so the shelf
 * looks loaded while the video streams behind it — the difference between
 * "fast" and "instant" without changing a single byte of the video.
 *
 * Browser-only: needs <video> and <canvas>.
 */

/** How far in to grab. Frame zero is very often black or a blurred pan. */
const SEEK_SECONDS = 0.6;
/** Poster width. These render at ~172px CSS, so 480 covers 2x screens. */
const MAX_WIDTH = 480;

export async function capturePoster(
  source: File | string,
  { timeoutMs = 12000 }: { timeoutMs?: number } = {}
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  const src = objectUrl ?? (source as string);

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Remote files need this or the canvas is tainted and toBlob throws.
  if (!objectUrl) video.crossOrigin = "anonymous";

  const cleanup = () => {
    video.removeAttribute("src");
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };

  try {
    return await new Promise<Blob | null>((resolve) => {
      // Never hang the upload on a file the browser can't decode — a .mov in
      // Chrome will simply never fire loadeddata.
      const timer = setTimeout(() => resolve(null), timeoutMs);
      const done = (b: Blob | null) => {
        clearTimeout(timer);
        resolve(b);
      };

      video.onerror = () => done(null);

      video.onloadeddata = () => {
        // Seek past the opening frame, but never past the end of a clip
        // shorter than the seek point.
        const target = Math.min(
          SEEK_SECONDS,
          Math.max(0, (video.duration || 1) / 2)
        );
        video.currentTime = target;
      };

      video.onseeked = () => {
        try {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (!w || !h) return done(null);
          const scale = Math.min(1, MAX_WIDTH / w);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return done(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => done(b), "image/jpeg", 0.72);
        } catch {
          // Tainted canvas, or a codec the browser decoded but won't hand
          // over. A missing poster is a slower card, not a broken one.
          done(null);
        }
      };

      video.src = src;
    });
  } finally {
    cleanup();
  }
}
