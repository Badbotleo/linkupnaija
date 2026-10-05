import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { SITE_ORIGIN } from "@/lib/qr";
import { pngToPdf } from "@/lib/print-pdf";
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
/**
 * A 4000px render is slow, and decoding it back out again for the PDF is
 * slower. Nothing waits on this but a print job.
 */
export const maxDuration = 60;

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
 * EQUAL TILES, AND NO HERO.
 *
 * The version before this opened on one photograph a third of the banner
 * tall. It was the best image we had and that was the problem: the eye
 * landed on it, stayed there, and everything underneath became wallpaper. A
 * banner selling "find your people" that fixes your attention on three
 * people is arguing against itself.
 *
 * Equal tiles make the argument instead. Different nights, different rooms,
 * nobody's face bigger than anybody else's, and the eye moves across them
 * rather than resting on one.
 *
 * ORDERED SO THAT THE FIRST FOUR ARE FOUR DIFFERENT EVENTS. This matters
 * more than it sounds, because both the gallery and the mosaic take the
 * first four and the old order gave them n1 and n3 together. Those two are
 * the same night in the same room under the same hanging wisteria, and at
 * tile size they read as one photograph printed twice. Somebody spotted it
 * immediately: "2 frames have the same people."
 *
 * n1, n2 and n3 ARE ONE NIGHT and n1 and n2 share a face, so at most one of
 * them belongs in any grid. They sit at the end of the list where no slice
 * of four can reach two of them.
 *
 * Beyond that the order alternates on every axis that reads at a distance:
 * night then day, crowd then pair, indoors then out. No quadrant of a grid
 * should resemble the one beside it.
 */
const TILES = [
  "/banner/n3.jpg", // night, club, dancing, arms up
  "/banner/m5.jpg", // daylight, park, nine of them standing
  "/banner/m1.jpg", // indoors, two of them, close
  "/banner/m2.jpg", // night, five faces, flash, close
  "/banner/n4.jpg", // dusk, outdoors, string lights
  "/banner/m3.jpg", // daylight, the big group picture
  "/banner/m4.jpg", // daylight, one of them, outdoors
  "/banner/n1.jpg", // same night as n3 — keep away from it
  "/banner/n2.jpg", // same night as n3, and shares a face with n1
];

/**
 * The Poster's full-bleed photograph, named rather than indexed.
 *
 * It used to be TILES[2], which quietly meant "whatever ends up third in a
 * list ordered for grid variety". Reordering that list for the gallery
 * would have swapped the poster's hero from a dance floor to a two-shot
 * without anybody touching the poster. A hero is a choice; it gets a name.
 */
const HERO = "/banner/n3.jpg";


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

/**
 * The banner, delivered.
 *
 * `?format=pdf` wraps the render in a PDF at the real printed size, which
 * for a roll-up is 800 by 2000mm. The design is already 1:2.5, so that is
 * the artwork at its own proportions rather than a crop or a stretch.
 *
 * This matters more here than anywhere else we print. A PNG does not state
 * how big it is, and a large-format shop handed a 4000px PNG has to guess:
 * guess high and the banner prints soft, guess low and it prints cropped.
 * The MediaBox is not a guess.
 *
 * ?mm=  the printed width in millimetres, if the stand is not 800.
 * ?w=   pixels, capped at 3200 for the reason given on the cap itself. For
 *       PDF it defaults to that cap, which at 800mm is about 102dpi.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantsPdf = (url.searchParams.get("format") ?? "").toLowerCase() === "pdf";
  const img = await renderBanner(req, wantsPdf);
  if (!wantsPdf) return img;

  const mm = Math.min(3000, Math.max(100, Number(url.searchParams.get("mm")) || 800));
  const png = Buffer.from(await img.arrayBuffer());
  const pdf = pngToPdf(png, mm, mm * 2.5, "LinkUpNaija banner");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="linkupnaija-banner.pdf"',
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

async function renderBanner(req: Request, wantsPdf: boolean) {
  const url = new URL(req.url);
  /**
   * 3200 IS A HARD CEILING, FOUND BY BISECTION, NOT A ROUND NUMBER.
   *
   * Above it Satori stops drawing the photographs. It does not fail: it
   * returns 200 with a perfectly composed banner that has four empty holes
   * where the people were, and the only tell is the file size collapsing
   * from 15MB to 437KB. At 4000 the render also takes 82 seconds to produce
   * that nothing. Measured: 3200 renders in 25s with every tile present,
   * 3600 in 51s with none of them.
   *
   * This is the same shape of bug as the WebP one — a silent blank where an
   * image should be, which reads as a design decision rather than a failure
   * — so the cap is set below it rather than left for somebody to discover
   * from a proof.
   *
   * 3200px across 800mm is about 102dpi, which is normal for large format.
   * Nobody reads a roll-up from nine inches away.
   */
  const W = Math.min(3200, Math.max(600, Number(url.searchParams.get("w")) || (wantsPdf ? 3200 : 1600)));
  const H = Math.round(W * 2.5);
  const u = (n: number) => Math.round((n / 1600) * W); // scale from the 1600 design

  /**
   * Three banners, not three colourways.
   *
   *   a  mosaic     nine equal tiles. Social proof by volume: many nights,
   *                 many rooms, no single face larger than another.
   *   b  statement  almost no photographs. Enormous type, one band of three
   *                 at the foot, a very large QR. Reads confident and quiet,
   *                 and survives being seen from the far side of a hall.
   *   c  editorial  photographs alternating with solid colour panels that
   *                 carry one promise each. The one that actually explains
   *                 what the platform does rather than only showing it.
   *
   * Same palette, same grid, same doodle field. They differ in what they ask
   * the reader to do, which is the only difference worth printing three of.
   */
  const variant = (url.searchParams.get("v") ?? "a").toLowerCase();

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

  /* ======================================================== b · GALLERY ====
   * Inverted. Cream ground, ink type, photographs framed by the paper rather
   * than bleeding off it.
   *
   * ATTENTION COMES FROM INVERSION, NOT VOLUME. Every other banner in a
   * Nigerian event hall is dark and loud, so the thing that stops somebody is
   * the one that is pale and quiet. It is the same trick a gallery wall uses,
   * and it costs nothing at the printer.
   *
   * CLASSIC MEANS A SYSTEM, not ornament. One margin, one rule weight, four
   * photographs on a strict grid with equal gutters, and type set at three
   * sizes and no more. Nothing is tilted, nothing overlaps, nothing is
   * decorative. What makes it look expensive is that everything lines up.
   */
  if (variant === "b") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: CREAM,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml,${encodeURIComponent(doodleField(W, H, "rgba(22,13,51,0.05)"))}`}
            alt=""
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
          />

          <div style={{ display: "flex", width: "100%" }}>
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
          </div>

          {/* The mark, then a hairline. A rule under a masthead is the oldest
              signal in print that what follows has been edited. */}
          <div style={{ display: "flex", alignItems: "center", gap: u(24), paddingLeft: u(110), marginTop: u(86) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={u(104)} height={u(104)} style={{ width: u(104), height: u(104) }} />
            <div style={{ display: "flex", fontSize: u(72), fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>
              Link<span style={{ color: "#6C5CE0" }}>Up</span>Naija
            </div>
          </div>
          <div style={{ display: "flex", height: u(4), marginLeft: u(110), marginRight: u(110), marginTop: u(46), backgroundColor: "rgba(22,13,51,0.16)" }} />

          <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(110), paddingRight: u(110), marginTop: u(76) }}>
            <div style={{ display: "flex", fontSize: u(224), fontWeight: 700, color: INK, letterSpacing: "-0.055em", lineHeight: 0.96 }}>
              Find your
            </div>
            <div style={{ display: "flex", fontSize: u(224), fontWeight: 700, color: "#D12B63", letterSpacing: "-0.055em", lineHeight: 0.96 }}>
              people.
            </div>
            {/* Three lines, not a paragraph. B was carrying the argument as
                three lines of grey prose, which is exactly what I criticised
                in the Poster: at four metres a paragraph is a grey rectangle
                and nobody reads a rectangle. Same claims, same order and the
                same coloured marks as C, so the two banners sound like one
                brand rather than two agencies. */}
            <div style={{ display: "flex", flexDirection: "column", marginTop: u(46), gap: u(20) }}>
              {(
                [
                  ["The host approves every guest", "#D12B63"],
                  ["You see who is coming before you go", "#0F7F8C"],
                  ["Something on, every single week", "#B07A00"],
                ] as [string, string][]
              ).map(([line, colour]) => (
                <div key={line} style={{ display: "flex", alignItems: "center", gap: u(22) }}>
                  <div style={{ display: "flex", width: u(28), height: u(9), backgroundColor: colour }} />
                  <div style={{ display: "flex", fontSize: u(54), fontWeight: 700, color: INK, letterSpacing: "-0.015em" }}>
                    {line}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Four photographs, equal gutters, framed by the paper. Bleeding
              them off the edge is the loud move; holding them inside the
              margin is the classic one. */}
          <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(110), paddingRight: u(110), marginTop: u(80), gap: u(18) }}>
            {[[0, 2], [2, 4]].map(([a, b]) => (
              <div key={a} style={{ display: "flex", gap: u(18) }}>
                {TILES.slice(a, b).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f}
                    src={img(f)}
                    alt=""
                    width={Math.round((W - u(220) - u(18)) / 2)}
                    height={u(1010)}
                    style={{ width: Math.round((W - u(220) - u(18)) / 2), height: u(1010), objectFit: "cover" }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* The QR inverts again, back to ink. On a pale banner the darkest
              object is the one the eye finishes on, which is where the only
              instruction should be. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(52),
              marginTop: u(64),
              marginLeft: u(110),
              marginRight: u(110),
              marginBottom: u(0),
              padding: u(52),
              backgroundColor: INK,
            }}
          >
            <div style={{ display: "flex", padding: u(18), backgroundColor: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="" width={u(400)} height={u(400)} style={{ width: u(400), height: u(400) }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: u(72), fontWeight: 700, color: CREAM, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
                linkupnaija.com
              </div>
              <div style={{ display: "flex", fontSize: u(44), fontWeight: 400, color: "rgba(255,244,230,0.7)", marginTop: u(14) }}>
                Point your camera. Free to join.
              </div>
              <div style={{ display: "flex", fontSize: u(40), fontWeight: 400, color: GOLD, marginTop: u(20) }}>
                @officiallinkupnaija
              </div>
            </div>
          </div>

          {/* A base. Without it the whole composition trailed off into a
              quarter of empty cream, which on a two metre banner reads as a
              printing error rather than as white space. The flag closes it,
              the same rule that opens it. */}
          <div style={{ display: "flex", width: "100%", marginTop: "auto" }}>
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#008753" }} />
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ========================================================= c · POSTER ====
   * The Swiss concert poster, which is the oldest attention-grabber there is
   * and has not dated in seventy years.
   *
   * Type does everything. Three words stacked the full width of the banner,
   * tight leading, flush left and right to the same margin, each line a
   * different colour. At twenty paces you read it before you have decided to.
   *
   * NO DOODLES, NO CHIPS, NO GRADIENT, NO ROUNDED CORNERS. Every one of those
   * is a way of making a design interesting, and this one is interesting
   * because of scale and restraint. Adding texture to it would be admitting
   * it did not work.
   *
   * ONE PHOTOGRAPH, cinematic and full bleed, used as a band rather than a
   * picture. It is there to prove the words are about real people, which it
   * can do at any size, so it takes the smallest space that still reads.
   */
  if (variant === "c") {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: INK, position: "relative" }}>
          {/* ------------------------------------------- the doodle field ---- */}
          {/* I left these off C on purpose, arguing that a type-led poster
              should be interesting through scale and restraint rather than
              texture. That was a defensible design position and the wrong
              call for a brand: the field is drawn from our own icon set, it
              runs on every other asset we make, and a banner without it is
              the one that looks like somebody else's.

              Fainter here than on the mosaic, 0.055 against 0.085. On a
              violet ground behind 360px type, anything stronger starts
              competing with the only three words that matter. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml,${encodeURIComponent(doodleField(W, H, "rgba(255,255,255,0.055)"))}`}
            alt=""
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
          />
          <div style={{ display: "flex", width: "100%" }}>
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: W / 3, height: u(26), backgroundColor: "#008753" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: u(22), paddingLeft: u(96), marginTop: u(70) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={u(92)} height={u(92)} style={{ width: u(92), height: u(92) }} />
            <div style={{ display: "flex", fontSize: u(62), fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
              Link<span style={{ color: "#A79BFF" }}>Up</span>Naija
            </div>
          </div>

          {/* The three words. Sized so the longest fills the measure exactly,
              which is what makes a stack like this look set rather than
              typed. */}
          <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(96), marginTop: u(96) }}>
            {([["FIND", CREAM], ["YOUR", ROSE], ["PEOPLE", GOLD]] as [string, string][]).map(([word, colour]) => (
              <div
                key={word}
                style={{
                  display: "flex",
                  fontSize: u(360),
                  fontWeight: 700,
                  color: colour,
                  letterSpacing: "-0.055em",
                  lineHeight: 0.86,
                }}
              >
                {word}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", height: u(6), marginLeft: u(96), marginRight: u(96), marginTop: u(76), backgroundColor: "rgba(255,244,230,0.28)" }} />

          {/* ------------------------------------------------ the claim ---- */}
          {/* C had the whole argument compressed into one small sentence
              under an enormous headline, so the thing that makes this
              platform different was the least legible object on a banner
              about it. FIND YOUR PEOPLE is what every events app says; THE
              HOST APPROVES EVERY GUEST is what only this one does.

              Still Swiss: flush left to the same margin, one weight, one
              size, no decoration. Three lines rather than a paragraph,
              because a paragraph at four metres is a grey rectangle. The
              coloured marks carry the only hierarchy. */}
          <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(96), paddingRight: u(96), marginTop: u(46), gap: u(22) }}>
            {(
              [
                ["The host approves every guest", ROSE],
                ["You see who is coming before you go", CYAN],
                ["Something on, every single week", GOLD],
              ] as [string, string][]
            ).map(([line, colour]) => (
              <div key={line} style={{ display: "flex", alignItems: "center", gap: u(24) }}>
                <div style={{ display: "flex", width: u(30), height: u(10), backgroundColor: colour }} />
                <div style={{ display: "flex", fontSize: u(58), fontWeight: 700, color: CREAM, letterSpacing: "-0.015em" }}>
                  {line}
                </div>
              </div>
            ))}
          </div>

          {/* ------------------------------------------- the QR, lifted ---- */}
          {/* CHEST HEIGHT, NOT THE FOOT OF THE BANNER. It sat in the gold bar
              at the bottom, which on a two metre roll-up is about 100mm off
              the floor: you scan that by crouching, and nobody crouches at a
              party holding a drink. Here it lands around 1.2m, which is where
              a phone already is when somebody is standing.

              On cream, because the one thing a passer-by has to act on should
              be the highest-contrast object on a dark banner, and inverting
              it costs nothing. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(44),
              marginTop: u(72),
              marginLeft: u(96),
              marginRight: u(96),
              padding: u(40),
              backgroundColor: CREAM,
            }}
          >
            <div style={{ display: "flex", padding: u(14), backgroundColor: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="" width={u(300)} height={u(300)} style={{ width: u(300), height: u(300) }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: u(62), fontWeight: 700, color: INK, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
                Point your
              </div>
              <div style={{ display: "flex", fontSize: u(62), fontWeight: 700, color: INK, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
                camera here
              </div>
              <div style={{ display: "flex", fontSize: u(36), fontWeight: 400, color: "rgba(22,13,51,0.66)", marginTop: u(12) }}>
                Free to join. Takes a minute.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", width: "100%", marginTop: u(76) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img(HERO)}
              alt=""
              width={W}
              height={u(1455)}
              style={{ width: W, height: u(1455), objectFit: "cover" }}
            />
          </div>

          {/* A square black-on-gold block. No rounding, no shadow, no panel
              inside a panel: the QR and the address are one object. */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              width: "100%",
              marginTop: "auto",
              backgroundColor: GOLD,
              paddingLeft: u(96),
              paddingRight: u(96),
              paddingTop: u(52),
              paddingBottom: u(52),
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: u(84), fontWeight: 700, color: INK, letterSpacing: "-0.03em" }}>
                linkupnaija.com
              </div>
              {/* The footer no longer repeats "Free to join. Takes a
                  minute." The QR panel above it already says that, and a
                  banner that tells you the same thing twice in two feet
                  reads as though nobody edited it. */}
              <div style={{ display: "flex", fontSize: u(46), fontWeight: 700, color: "rgba(22,13,51,0.75)", marginTop: u(16) }}>
                @officiallinkupnaija
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ============================================ a · MOSAIC, unchanged ==== */

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
          <div style={{ display: "flex", fontSize: u(variant === "b" ? 250 : 210), fontWeight: 700, color: CREAM, letterSpacing: "-0.045em", lineHeight: 1 }}>
            FIND YOUR
          </div>
          <div style={{ display: "flex", fontSize: u(variant === "b" ? 250 : 210), fontWeight: 700, color: GOLD, letterSpacing: "-0.045em", lineHeight: 1 }}>
            PEOPLE.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: u(20), marginTop: u(34) }}>
            <div style={{ display: "flex", width: u(80), height: u(8), backgroundColor: ROSE, borderRadius: u(4) }} />
            <div style={{ display: "flex", fontSize: u(50), fontWeight: 400, color: "rgba(255,244,230,0.82)" }}>
              Real link-ups near you, every week
            </div>
          </div>
        </div>

        {/* ============================================ the statement ==== */}
        {/* Variant b only. Without it the type-led version had six hundred units of
            empty violet under the headline, which is not air, it is an
            unfinished banner. A type-led design has to have something to say
            in type. */}
        {variant === "b" && (
          <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(90), paddingRight: u(90), marginTop: u(150) }}>
            {["You already go out.", "You just don't always", "know who else is going."].map((line, i) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  fontSize: u(96),
                  fontWeight: 700,
                  color: i === 2 ? GOLD : "rgba(255,244,230,0.92)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.16,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {/* ============================================== the pictures ==== */}
        {/* Edge to edge in every variant, because touching tiles read as one
            field of a good time and spaced ones read as separate small
            pictures, which puts the attention back on whichever is
            brightest. What changes is how many and how tall. */}
        {variant === "c" ? (
          /* EDITORIAL. Two tiles, then a colour panel carrying a promise,
             then two more. The panels are the argument and the photographs
             are the evidence, alternating so neither runs long enough to
             become scenery. */
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: u(70) }}>
            {(
              [
                [[0, 2], "The host approves every guest", ROSE],
                [[2, 4], "See who's coming before you go", CYAN],
                [[4, 6], "Something on every single week", GOLD],
              ] as [[number, number], string, string][]
            ).map(([[from, to], line, colour]) => (
              <div key={line} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                <div style={{ display: "flex", width: "100%" }}>
                  {TILES.slice(from, to).map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f}
                      src={img(f)}
                      alt=""
                      width={Math.round(W / 2)}
                      height={u(560)}
                      style={{ width: Math.round(W / 2), height: u(560), objectFit: "cover" }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    backgroundColor: colour,
                    paddingLeft: u(90),
                    paddingRight: u(90),
                    paddingTop: u(30),
                    paddingBottom: u(32),
                    fontSize: u(60),
                    fontWeight: 700,
                    color: INK,
                  }}
                >
                  {line}
                </div>
              </div>
            ))}
          </div>
        ) : variant === "b" ? (
          /* STATEMENT. One band of three, low down, so the top two thirds
             are type and air. */
          <div style={{ display: "flex", width: "100%", marginTop: u(150) }}>
            {TILES.slice(0, 3).map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                src={img(f)}
                alt=""
                width={Math.round(W / 3)}
                height={u(1060)}
                style={{ width: Math.round(W / 3), height: u(1060), objectFit: "cover" }}
              />
            ))}
          </div>
        ) : (
          /* MOSAIC. Four tiles, not nine.
             Nine was too many: at that size each photograph is a thumbnail,
             the faces stop being legible from standing distance, and the
             block reads as a texture rather than as people. Four at double
             the size occupies exactly the same height and you can actually
             see who is in them, which was the entire point of using real
             members. */
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: u(76) }}>
            {[0, 2].map((row) => (
              <div key={row} style={{ display: "flex", width: "100%" }}>
                {TILES.slice(row, row + 2).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f}
                    src={img(f)}
                    alt=""
                    width={Math.round(W / 2)}
                    height={u(900)}
                    style={{ width: Math.round(W / 2), height: u(900), objectFit: "cover" }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ================================================= what's on ==== */}
        {/* Variant c says the same thing in its colour panels, so repeating
            it as chips would be the banner talking twice. */}
        {variant !== "c" && (
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
        )}

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
