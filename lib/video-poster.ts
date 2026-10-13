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

/**
 * Does this file actually decode in a browser, and how big is it?
 *
 * Asked of the file itself rather than of its MIME string. canPlayType takes
 * a label and answers about the label: it says nothing about whether a
 * particular .mov holds H.264 the browser can read or HEVC it cannot, and it
 * has no opinion at all about an image. Decoding the thing is the only
 * question worth asking, and it costs one object URL.
 *
 * `w` and `h` are the decoded dimensions, zero for an image we only needed to
 * prove readable.
 */
export async function probeMedia(
  file: File,
  isVideo: boolean,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<{ ok: boolean; w: number; h: number }> {
  if (typeof document === "undefined") return { ok: true, w: 0, h: 0 };

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const done = (r: { ok: boolean; w: number; h: number }) => {
        clearTimeout(timer);
        resolve(r);
      };
      // A file too slow to decode is a file too slow to watch. Treated as a
      // pass so a sluggish laptop never blocks a good upload.
      const timer = setTimeout(() => done({ ok: true, w: 0, h: 0 }), timeoutMs);

      if (!isVideo) {
        const img = new Image();
        img.onload = () =>
          done({ ok: img.naturalWidth > 0, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => done({ ok: false, w: 0, h: 0 });
        img.src = url;
        return;
      }

      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      // videoWidth of zero with metadata loaded is the exact signature of a
      // file whose audio track decodes and whose video track does not, which
      // is what "it opens but there's only sound" is.
      v.onloadedmetadata = () =>
        done({ ok: v.videoWidth > 0, w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => done({ ok: false, w: 0, h: 0 });
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
