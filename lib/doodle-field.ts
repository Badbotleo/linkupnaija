import { PATHS } from "@/components/ui/LineIcon";

/**
 * The doodle field, built from our own icon set.
 *
 * Asked for after the WhatsApp chat wallpaper: a dense, all-over scatter of
 * small line drawings, low contrast, covering the whole ground. That pattern
 * works because it is busy enough to read as texture and faint enough to read
 * as nothing at all.
 *
 * OURS ARE OUR OWN ICONS, not generic doodles. components/ui/LineIcon already
 * holds forty stroke glyphs at a 24 viewBox, and the ones chosen here are the
 * things the platform is actually about: a calendar, a ticket, a gamepad, a
 * pin, a heart, people. A stranger reads it as texture; anybody who has used
 * the app is looking at its own furniture.
 *
 * ONE <img>, NOT HUNDREDS OF DIVS. Satori lays out every element it is given,
 * and a few hundred absolutely positioned nodes is both slow and a good way
 * to blow the layout up. This is a single SVG, placed once, and being vector
 * it stays exact at 3150px wide.
 *
 * Deterministic on purpose: a seeded generator rather than Math.random, so a
 * re-render produces the identical banner and the printer's proof still
 * matches what was approved.
 *
 * Lifted out of the banner route so the Instagram cards can use the same
 * texture. It was never banner-specific; it was just written there first,
 * and a second copy would have been a second set of glyphs to keep in step.
 *
 * `cols` is how many glyphs fit across the width, and it is the only knob
 * that matters: it sets the size of everything. Thirteen is right for a two
 * metre banner. A 1080 square wants more and smaller, or the doodles stop
 * being texture and start being content.
 */
export function doodleField(w: number, h: number, stroke: string, cols = 13): string {
  const keys = [
    "calendar", "ticket", "users", "heart", "star", "pin", "gamepad", "gift",
    "camera", "mic", "trophy", "sparkles", "chat", "car", "video", "play",
    "zap", "clock", "circles", "share", "trending", "eye", "building", "link",
    "phone", "search", "bell", "shield", "activity", "send", "image", "home",
  ].filter((k) => PATHS[k]);

  // Mulberry32. Small, fast, and repeatable from a fixed seed.
  let t = 0x9e3779b9;
  const rnd = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  // Thirteen across. Eight left gaps you could drive through and read
  // as scattered marks rather than a field; the reference wallpaper is dense
  // enough that no single glyph is the thing you notice.
  const step = Math.round(w / cols);
  const size = Math.round(step * 0.66);
  const parts: string[] = [];

  for (let y = -step; y < h + step; y += step) {
    for (let x = -step; x < w + step; x += step) {
      const k = keys[Math.floor(rnd() * keys.length)];
      const jx = (rnd() - 0.5) * step * 0.55;
      const jy = (rnd() - 0.5) * step * 0.55;
      const rot = Math.round((rnd() - 0.5) * 60);
      const sc = size / 24;
      const cx = x + jx;
      const cy = y + jy;
      parts.push(
        `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot}) scale(${sc.toFixed(3)}) translate(-12 -12)">` +
          `<path d="${PATHS[k]}"/></g>`
      );
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<g fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` +
    parts.join("") +
    `</g></svg>`
  );
}
