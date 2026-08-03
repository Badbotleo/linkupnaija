import { readFile } from "fs/promises";
import path from "path";

/**
 * Fonts for the images we generate with next/og.
 *
 * Satori's built-in font is Noto Sans **latin**, and that subset stops at
 * U+007F-ish — it has no Currency Symbols block, so ₦ (U+20A6) rendered as a
 * tofu box on every paid event's share card. These are the **latin-ext**
 * builds, which cover U+20A0–U+20AB and therefore the Naira sign.
 *
 * Read from disk once per process and cached: the files are ~550KB each and
 * re-reading them per request would show up in card render time.
 *
 * Noto Sans is SIL Open Font License 1.1 — bundling and redistribution are
 * permitted.
 */
export interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

let cached: OgFont[] | null = null;

export async function ogFonts(): Promise<OgFont[]> {
  if (cached) return cached;

  const dir = path.join(process.cwd(), "assets", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "NotoSans-Regular.ttf")),
    readFile(path.join(dir, "NotoSans-Bold.ttf")),
  ]);

  // One family name for both weights so `fontWeight: 800` picks the bold cut
  // rather than falling back to a font without the Naira glyph.
  cached = [
    { name: "Noto Sans", data: regular, weight: 400, style: "normal" },
    { name: "Noto Sans", data: bold, weight: 700, style: "normal" },
  ];
  return cached;
}
