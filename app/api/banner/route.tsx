import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { SITE_ORIGIN } from "@/lib/qr";
import { ogFonts } from "@/lib/og-fonts";
import { PATHS } from "@/components/ui/LineIcon";

/**
 * The pull-up banner. 800 × 2000 mm, the standard Nigerian roll-up.
 *
 * It advertises LinkUpNaija, not the party it stands at. Somebody reading a
 * banner beside a jollof queue is already out and already enjoying
 * themselves, which makes them exactly the person who should be on the
 * platform, so it sells the thing they can take home.
 *
 * ?w= sets the pixel width and the height follows at 2:5. Default 1600 for a
 * quick look; ?w=3150 is 100 dpi at full size, which is what a print shop
 * will ask for.
 *
 * WHAT THREE EARLIER VERSIONS GOT WRONG, because it was the same mistake each
 * time:
 *
 *   Everything was centred and stacked. Logo, tagline, headline, photos,
 *   bullets, chips, QR, footer, each a centred row under the last. That is a
 *   list, not a composition, and it reads as a slide deck however good the
 *   colours are.
 *
 *   The photographs were small white-bordered cards floating in violet. A
 *   polaroid is a twee metaphor for a nightlife brand, and shrinking your
 *   best asset to a third of the width to put a frame round it is backwards.
 *
 *   Pattern in the background does not fix an empty middle.
 *
 * SO THIS IS BUILT IN BANDS, full width, edge to edge. A hero photograph
 * carries the top third with the mark over it and a gradient taking it into
 * the headline. A second strip bleeds across with no borders and no gaps. The
 * QR sits on a solid cream panel spanning the banner, so the one thing a
 * passer-by has to act on is the highest-contrast object on the surface.
 * Nothing floats.
 *
 * READ STANDING UP, FROM ABOUT A METRE AND A HALF. The hero is above eye line
 * and does the work at twenty paces. Headline and strip are at eye level. The
 * QR panel is at chest height, because a code at the foot of a two metre
 * banner is scanned by crouching and nobody does that holding a plate. The
 * footer is at knee height and carries only what is read, never used.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "#160D33";
const INK_2 = "#241657";
const GOLD = "#FFC93C";
const ROSE = "#FF4E8E";
const CYAN = "#3FD0E0";
const CREAM = "#FFF4E6";

/**
 * Real members at real link-ups, trimmed of their phone letterboxing and
 * squared by hand at the point where the faces actually sit.
 */
/**
 * SIX, ALL THE SAME SIZE, AND NO HERO.
 *
 * The version before this opened on one photograph a third of the banner
 * tall. It was the best image we had and that was the problem: the eye
 * landed on it, stayed there, and everything underneath became wallpaper. A
 * banner selling "find your people" that fixes your attention on three
 * people is arguing against itself.
 *
 * Equal tiles make the argument instead. Six different nights, six different
 * rooms, nobody's face bigger than anybody else's, and the eye moves across
 * them rather than resting on one. Ordered so that neighbours differ in
 * light and crowd: a bright crowd next to a dim two-shot, indoors next to
 * outdoors, so no quadrant of the grid reads as one photograph.
 */
const TILES = [
  "/banner/n1.jpg", // crowd, braids, phones up
  "/banner/m1.jpg", // two of them, indoors, close
  "/banner/n3.jpg", // dancing, arms up
  "/banner/n4.jpg", // outside, string lights
  "/banner/m4.jpg", // one of them, daylight, outdoors
  "/banner/n2.jpg", // drinks going round
  "/banner/m2.jpg", // a group, mid-laugh
  "/banner/m5.jpg", // daylight group shot
  "/banner/m3.jpg", // the big group picture
];


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
 */
function doodleField(w: number, h: number, stroke: string): string {
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
  const step = Math.round(w / 13);
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const W = Math.min(4000, Math.max(600, Number(url.searchParams.get("w")) || 1600));
  const H = Math.round(W * 2.5);
  const u = (n: number) => Math.round((n / 1600) * W); // scale from the 1600 design

  /**
   * Absolute, and versioned by the file's own modification time.
   *
   * Satori fetches every <img> over HTTP, so a relative path resolves to
   * nothing. THE ?v IS NOT DECORATION: those fetches go through the fetch
   * Next patches and caches, .next/cache survives a restart, and re-cropping
   * the photographs once changed nothing on screen through two restarts.
   * force-dynamic does not help, because it governs whether the route re-runs
   * and not what the fetch inside it answers with.
   */
  const { statSync } = await import("node:fs");
  const ver = (f: string) => {
    try {
      return String(Math.round(statSync(`${process.cwd()}/public${f}`).mtimeMs));
    } catch {
      return "0";
    }
  };
  const img = (f: string) => `${url.origin}${f}?v=${ver(f)}`;

  /**
   * Encoded here rather than by qrcode.react, which is a client component
   * built on hooks and dies in a route handler with "Cannot read properties
   * of null (reading 'useMemo')". Error correction H: a banner picks up dust,
   * creases and fingerprints within a week, and H survives about 30% of the
   * code being unreadable.
   */
  const qrSvg = await QRCode.toString(SITE_ORIGIN, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
    color: { dark: INK, light: "#ffffff" },
  });
  const qrSrc = `data:image/svg+xml,${encodeURIComponent(qrSvg)}`;

  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          backgroundImage: `linear-gradient(175deg, ${INK_2} 0%, ${INK} 45%)`,
        }}
      >
        {/* ============================================== the doodles ==== */}
        {/* Under everything, over nothing. It only shows through in the
            violet bands, which is the point: it gives the empty ground a
            surface without competing with a photograph or a word. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(doodleField(W, H, "rgba(255,255,255,0.085)"))}`}
          alt=""
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
        />

        {/* ================================================ the header ==== */}
        <div style={{ display: "flex", width: "100%" }}>
          <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
          <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#FFFFFF" }} />
          <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: u(24), paddingLeft: u(90), marginTop: u(74) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={u(110)} height={u(110)} style={{ width: u(110), height: u(110) }} />
          <div style={{ display: "flex", fontSize: u(76), fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
            Link<span style={{ color: "#A79BFF" }}>Up</span>Naija
          </div>
        </div>

        {/* ============================================== the headline ==== */}
        {/* It carries the top now that no photograph does. On a roll-up read
            from twenty paces something has to work at that distance, and
            without a hero it has to be the words. */}
        <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(90), paddingRight: u(90), marginTop: u(56) }}>
          <div style={{ display: "flex", fontSize: u(210), fontWeight: 700, color: CREAM, letterSpacing: "-0.045em", lineHeight: 1 }}>
            FIND YOUR
          </div>
          <div style={{ display: "flex", fontSize: u(210), fontWeight: 700, color: GOLD, letterSpacing: "-0.045em", lineHeight: 1 }}>
            PEOPLE.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: u(20), marginTop: u(34) }}>
            <div style={{ display: "flex", width: u(80), height: u(8), backgroundColor: ROSE, borderRadius: u(4) }} />
            <div style={{ display: "flex", fontSize: u(50), fontWeight: 400, color: "rgba(255,244,230,0.82)" }}>
              Real link-ups near you, every week
            </div>
          </div>
        </div>

        {/* ================================================ the mosaic ==== */}
        {/* Two rows of three, edge to edge, no gaps and no borders. Touching
            tiles read as one field of a good time; spaced ones read as six
            small pictures and put the attention back on whichever is
            brightest. */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: u(76) }}>
          {[0, 3, 6].map((row) => (
          <div key={row} style={{ display: "flex", width: "100%" }}>
            {TILES.slice(row, row + 3).map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                src={img(f)}
                alt=""
                width={Math.round(W / 3)}
                height={u(600)}
                style={{ width: Math.round(W / 3), height: u(600), objectFit: "cover" }}
              />
            ))}
          </div>
          ))}
        </div>

        {/* ================================================= what's on ==== */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: u(16),
            paddingLeft: u(90),
            paddingRight: u(90),
            marginTop: u(70),
          }}
        >
          {(
            [
              ["Parties", ROSE],
              ["Game nights", CYAN],
              ["Picnics", GOLD],
              ["Concerts", ROSE],
              ["Hikes", CYAN],
              ["Karaoke", GOLD],
              ["Dinners", ROSE],
              ["Beach days", CYAN],
              ["Road trips", GOLD],
            ] as [string, string][]
          ).map(([c, colour]) => (
            <div
              key={c}
              style={{
                display: "flex",
                borderRadius: u(999),
                backgroundColor: colour,
                paddingTop: u(15),
                paddingBottom: u(15),
                paddingLeft: u(34),
                paddingRight: u(34),
                fontSize: u(42),
                fontWeight: 700,
                color: INK,
              }}
            >
              {c}
            </div>
          ))}
        </div>

        {/* ============================================== the QR panel ==== */}
        {/* Cream, spanning the banner, at chest height. The one thing a
            passer-by has to act on should be the highest-contrast object on
            the surface, and on a dark banner that means inverting it rather
            than adding another glow. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: u(56),
            marginTop: u(92),
            marginLeft: u(90),
            marginRight: u(90),
            padding: u(64),
            borderRadius: u(60),
            backgroundColor: CREAM,
          }}
        >
          <div style={{ display: "flex", padding: u(20), backgroundColor: "#fff", borderRadius: u(24) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="" width={u(470)} height={u(470)} style={{ width: u(470), height: u(470) }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: u(78), fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              Point your
            </div>
            <div style={{ display: "flex", fontSize: u(78), fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              camera here
            </div>
            <div style={{ display: "flex", fontSize: u(42), fontWeight: 400, color: "rgba(22,13,51,0.66)", marginTop: u(18) }}>
              Free to join. Takes a minute.
            </div>
          </div>
        </div>

        {/* ================================================ the footer ==== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingLeft: u(90),
            paddingRight: u(90),
            paddingTop: u(44),
            paddingBottom: u(52),
            width: "100%",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", fontSize: u(76), fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            linkupnaija.com
          </div>
          <div style={{ display: "flex", fontSize: u(44), fontWeight: 400, color: GOLD }}>
            @officiallinkupnaija
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
