import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * Independence Day. Nigeria at sixty-six, 1 October 2026.
 *
 * ?ratio=story gives 1080x1920 for a Story or status, which is where a
 * greeting like this actually gets seen. Default is 1080x1350, the tallest
 * thing the Instagram feed allows.
 *
 * WHITE GROUND, NOT THE BRAND VIOLET. Every other asset we make is violet,
 * and on 1 October a violet card is a brand talking about itself. White and
 * green is the flag, and the point of the day is that the flag outranks us.
 * Our mark goes on small at the top and the handle goes at the bottom, which
 * is the whole of our presence on it.
 *
 * THE GREETING IS NOT A PROMOTION. No QR, no "join free", no event. Somebody
 * forwarding this to family should not be forwarding an advert, and a brand
 * that cannot say happy independence day without asking for something is not
 * really saying it.
 *
 * The flag is drawn as three bands with the green ones overlapping the top
 * edge at a slight angle, because a perfectly level tricolour at the top of
 * a poster reads as a web header. Satori has no blur and no texture, so the
 * reference's crumpled fabric is not reproducible here; flat colour and a
 * confident size does the same job.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GREEN = "#0A5C2E";
const GREEN_DEEP = "#073F20";
const PAPER = "#FBFBF8";


/**
 * A flag with folds in it, rather than three rectangles.
 *
 * The reference is a photograph of real cloth: the green panel hangs from the
 * top, the edge waves, and the folds catch light. Three flat bands read as a
 * web page header instead of a flag, which is what the first version looked
 * like.
 *
 * Satori has no filters, no blur and no mesh gradients, so the cloth is built
 * the way a flat illustrator would build it: a wavy silhouette, the three
 * colours clipped inside it, then a handful of straight-edged shadow and
 * highlight shapes laid over the top at low alpha. Folds are quadrilaterals,
 * not blurs. At a metre away on a phone that reads as fabric, which is all it
 * has to do.
 *
 * Returned as one SVG data URI and placed as a single <img>, because Satori
 * lays out every element it is handed and a flag made of forty divs is both
 * slow and fragile.
 */
function drapedFlag(w: number, h: number): string {
  const G = "#0A5C2E";
  const G_DARK = "#063F1E";
  const G_LIGHT = "#1C7A42";
  const third = w / 3;

  // The hanging edge. Two long waves, deeper on the right, so the cloth looks
  // like it is held at the top and falling rather than pinned flat.
  const edge =
    `M0,0 L${w},0 L${w},${h * 0.62} ` +
    `C${w * 0.82},${h * 0.92} ${w * 0.68},${h * 0.52} ${w * 0.5},${h * 0.76} ` +
    `C${w * 0.33},${h * 0.98} ${w * 0.18},${h * 0.6} 0,${h * 0.86} Z`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><clipPath id="c"><path d="${edge}"/></clipPath></defs>` +
    `<g clip-path="url(#c)">` +
      `<rect x="0" y="0" width="${third}" height="${h}" fill="${G}"/>` +
      `<rect x="${third}" y="0" width="${third}" height="${h}" fill="#FFFFFF"/>` +
      `<rect x="${third * 2}" y="0" width="${third}" height="${h}" fill="${G}"/>` +

      // Folds. Each is a slanted band: one dark where the cloth turns away,
      // one light on the crest beside it.
      `<path d="M${w * 0.06},0 L${w * 0.17},0 L${w * 0.12},${h} L${w * 0.01},${h} Z" fill="${G_DARK}" opacity="0.5"/>` +
      `<path d="M${w * 0.17},0 L${w * 0.235},0 L${w * 0.185},${h} L${w * 0.12},${h} Z" fill="${G_LIGHT}" opacity="0.45"/>` +
      `<path d="M${w * 0.40},0 L${w * 0.49},0 L${w * 0.455},${h} L${w * 0.365},${h} Z" fill="#000000" opacity="0.07"/>` +
      `<path d="M${w * 0.55},0 L${w * 0.61},0 L${w * 0.585},${h} L${w * 0.525},${h} Z" fill="#000000" opacity="0.05"/>` +
      `<path d="M${w * 0.72},0 L${w * 0.83},0 L${w * 0.80},${h} L${w * 0.69},${h} Z" fill="${G_DARK}" opacity="0.55"/>` +
      `<path d="M${w * 0.83},0 L${w * 0.90},0 L${w * 0.875},${h} L${w * 0.80},${h} Z" fill="${G_LIGHT}" opacity="0.4"/>` +

      // The hem: the cloth is thicker and darker where it folds under.
      `<path d="M0,${h * 0.80} C${w * 0.18},${h * 0.54} ${w * 0.33},${h * 0.92} ${w * 0.5},${h * 0.70} ` +
        `C${w * 0.68},${h * 0.46} ${w * 0.82},${h * 0.86} ${w},${h * 0.56} ` +
        `L${w},${h * 0.62} C${w * 0.82},${h * 0.92} ${w * 0.68},${h * 0.52} ${w * 0.5},${h * 0.76} ` +
        `C${w * 0.33},${h * 0.98} ${w * 0.18},${h * 0.6} 0,${h * 0.86} Z" fill="#000000" opacity="0.13"/>` +
    `</g></svg>`
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const story = url.searchParams.get("ratio") === "story";
  const W = 1080;
  const H = story ? 1920 : 1350;
  /**
   * TWO SCALES, AND THE FIRST VERSION HAD ONE.
   *
   * Type was scaled by height. The width is fixed at 1080 in both ratios, so
   * switching to a Story made every word 1.42x wider with no extra room:
   * INDEPENDENCE ran off both edges and the blocks underneath overlapped
   * each other.
   *
   *   t()  type and anything measured across the card. Constant, because the
   *        card is always 1080 wide.
   *   v()  vertical rhythm only. This is the one that may stretch.
   */
  const t = (n: number) => n;

  /**
   * The headline is smaller on the feed card.
   *
   * Both ratios are 1080 wide, so the type FITS across either way, but the
   * 1350 card is 570px shorter and the stack overflowed it: NIGERIA AT
   * SIXTY-SIX printed straight through the sentence underneath. Satori does
   * not clip or scroll, it just draws one thing on top of another, so an
   * overflow is silent and looks like a design decision.
   */
  /**
   * One line, which decides the size.
   *
   * INDEPENDENCE is twelve capitals. On a 1080 card with a 60px margin either
   * side that is 960px for twelve letters, so at Noto Sans Bold with the
   * tracking below it lands just under 100px. Bigger than that and it clips,
   * which Satori does silently.
   */
  const BIG = story ? 99 : 93;
  const DAY = story ? 104 : 86;
  const v = (n: number) => Math.round((n / 1350) * H);

  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: PAPER,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(drapedFlag(W, v(story ? 420 : 330)))}`}
          alt=""
          width={W}
          height={v(story ? 420 : 330)}
          style={{ width: W, height: v(story ? 420 : 330) }}
        />

        {/* Our mark, small, at the top. The flag outranks us today. */}
        <div style={{ display: "flex", alignItems: "center", gap: t(16), marginTop: v(54) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={t(56)} height={t(56)} style={{ width: t(56), height: t(56) }} />
          <div style={{ display: "flex", fontSize: t(40), fontWeight: 700, letterSpacing: "-0.02em", color: "#2B2B2B" }}>
            LinkUpNaija
          </div>
        </div>

        {/* ------------------------------------------------- the greeting -- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: v(story ? 150 : 56) }}>
          <div style={{ display: "flex", fontSize: story ? t(74) : t(62), fontWeight: 400, color: GREEN, letterSpacing: "-0.01em" }}>
            Happy
          </div>
          <div style={{ display: "flex", fontSize: BIG, fontWeight: 700, color: GREEN_DEEP, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: v(2) }}>
            INDEPENDENCE
          </div>
          <div style={{ display: "flex", fontSize: DAY, fontWeight: 400, color: GREEN, letterSpacing: "-0.02em", marginTop: v(4) }}>
            Day
          </div>

          <div style={{ display: "flex", width: t(110), height: t(6), backgroundColor: GREEN, marginTop: v(40) }} />

          <div
            style={{
              display: "flex",
              fontSize: t(38),
              fontWeight: 400,
              color: "#4A4A46",
              letterSpacing: "0.2em",
              marginTop: v(36),
            }}
          >
            {story ? "NIGERIA AT" : "NIGERIA AT SIXTY-SIX"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(38),
              fontWeight: 400,
              color: "#4A4A46",
              letterSpacing: "0.2em",
              marginTop: v(8),
              opacity: story ? 1 : 0,
              height: story ? "auto" : 0,
            }}
          >
            SIXTY-SIX
          </div>
        </div>

        {/* ------------------------------------------------------- the line -- */}
        {/* One sentence, ours, that is about the day rather than about us. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: v(60),
            marginBottom: v(76),
            paddingLeft: t(110),
            paddingRight: t(110),
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(34),
              fontWeight: 400,
              color: "#5A5A55",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            Sixty-six years of a country that never does anything quietly.
          </div>
          <div style={{ display: "flex", fontSize: t(32), fontWeight: 700, color: GREEN, marginTop: v(30) }}>
            linkupnaija.com
          </div>
          <div style={{ display: "flex", fontSize: t(26), fontWeight: 400, color: "#8A8A85", marginTop: v(8) }}>
            @officiallinkupnaija
          </div>
        </div>

      </div>
    ),
    { width: W, height: H, fonts }
  );
}
