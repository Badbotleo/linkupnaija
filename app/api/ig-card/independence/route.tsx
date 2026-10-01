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
  const BIG = story ? 142 : 116;
  const DAY = story ? 96 : 78;
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
        {/* The flag, across the top. Green, white, green. */}
        <div style={{ display: "flex", width: W, height: v(120) }}>
          <div style={{ display: "flex", width: W / 3, height: v(120), backgroundColor: GREEN }} />
          <div style={{ display: "flex", width: W / 3, height: v(120), backgroundColor: "#FFFFFF" }} />
          <div style={{ display: "flex", width: W / 3, height: v(120), backgroundColor: GREEN }} />
        </div>

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
          {/* Split across two lines, as the reference does. One word of
              twelve letters on a 1080 card is either tiny or clipped; broken
              in two it can be the biggest thing on the card and still fit. */}
          <div style={{ display: "flex", fontSize: BIG, fontWeight: 700, color: GREEN_DEEP, letterSpacing: "-0.045em", lineHeight: 1.0, marginTop: v(-4) }}>
            INDEPEN
          </div>
          <div style={{ display: "flex", fontSize: BIG, fontWeight: 700, color: GREEN_DEEP, letterSpacing: "-0.045em", lineHeight: 1.0 }}>
            DENCE
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
            marginBottom: v(64),
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

        {/* The flag again, closing the card. */}
        <div style={{ display: "flex", width: W, height: v(34) }}>
          <div style={{ display: "flex", width: W / 3, height: v(34), backgroundColor: GREEN }} />
          <div style={{ display: "flex", width: W / 3, height: v(34), backgroundColor: "#FFFFFF" }} />
          <div style={{ display: "flex", width: W / 3, height: v(34), backgroundColor: GREEN }} />
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
