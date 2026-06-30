// Client-side image compression. Resizes large uploads down to a sane max
// dimension and re-encodes them as JPEG, so we never push multi-MB phone
// photos into Supabase storage (which then have to be downloaded by everyone).
//
// Falls back to the original file if anything goes wrong (e.g. an unsupported
// format), so an upload never fails just because compression did.

export interface CompressOptions {
  /** Longest edge of the output image, in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
}

export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.8 }: CompressOptions = {}
): Promise<File> {
  // Only attempt to compress raster images in the browser.
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  // SVGs and GIFs (animation) shouldn't be rasterized.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));

    // Already small enough and not worth re-encoding.
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close?.();
      return file;
    }

    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // no win — keep original

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
