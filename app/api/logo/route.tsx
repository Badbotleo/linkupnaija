import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The logo, exported.
 *
 * The mark has always lived as geometry in lib/logo-svg.ts, which is right
 * for the app and useless for everyone else: a printer, a venue putting us on
 * a poster, or a partner adding us to a sponsor row cannot import a
 * TypeScript constant. There was no file to send them, so every request for
 * "your logo" ended in somebody screenshotting the website.
 *
 * ?v=
 *   mark        the circle alone, square
 *   horizontal  mark and wordmark side by side, the default lockup
 *   stacked     mark above wordmark, for square and narrow spaces
 *   full        a full page: mark, name and slogan, centred. A4 portrait at
 *               300dpi by default, which is what a print shop expects for a
 *               cover sheet, a brand page in a deck, or the back of a flyer.
 *
 * ?on=dark      white wordmark for dark grounds. The mark itself does not
 *               change: it carries its own circle, so it needs no knockout
 *               version and inventing one would be a second logo to keep in
 *               step with this one.
 *
 * ?w=           pixel width. Default 2400, which is enough for a printed
 *               sponsor row at A3. The SVG mark stays sharp at any size; the
 *               wordmark is type, so ask for the size you need rather than
 *               scaling the PNG afterwards.
 *
 * ?bg=          a hex fill, without the hash, for when a transparent PNG is
 *               refused. Transparent by default.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const variant = (url.searchParams.get("v") ?? "horizontal").toLowerCase();
  const dark = url.searchParams.get("on") === "dark";
  const bgParam = url.searchParams.get("bg");
  const background = bgParam ? `#${bgParam.replace(/^#/, "")}` : "transparent";

  const W = Math.min(4000, Math.max(200, Number(url.searchParams.get("w")) || 2400));

  const ink = dark ? "#FFFFFF" : "#17123A";
  const up = dark ? "#A79BFF" : "#534AB7";

  const fonts = await ogFonts();

  if (variant === "mark") {
    // Square, and the mark fills it edge to edge. A logo file with built-in
    // padding is one somebody else has to crop.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: background,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={W} height={W} style={{ width: W, height: W }} />
        </div>
      ),
      { width: W, height: W, fonts }
    );
  }

  /* ============================================================= full ==== */
  if (variant === "full") {
    /**
     * A4 portrait at 300dpi unless asked otherwise. Everything is sized from
     * the page WIDTH, never the height, so an A3 or a square comes out as the
     * same design larger rather than a different one stretched.
     */
    const PW = Math.min(5000, Math.max(600, Number(url.searchParams.get("w")) || 2480));
    const PH = Math.round(Number(url.searchParams.get("h")) || PW * Math.SQRT2);
    const k = (n: number) => Math.round((n / 2480) * PW);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bgParam ? background : dark ? "#160D33" : "#FFFFFF",
            position: "relative",
          }}
        >
          {/* The flag, top and bottom, as on everything else we print. */}
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: PW }}>
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#008753" }} />
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, display: "flex", width: PW }}>
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: PW / 3, height: k(26), backgroundColor: "#008753" }} />
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={k(620)} height={k(620)} style={{ width: k(620), height: k(620) }} />

          <div
            style={{
              display: "flex",
              fontSize: k(250),
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: ink,
              marginTop: k(72),
            }}
          >
            Link<span style={{ color: up }}>Up</span>Naija
          </div>

          <div style={{ display: "flex", width: k(150), height: k(9), backgroundColor: up, marginTop: k(58) }} />

          {/* The slogan on two lines, broken at the full stop rather than
              wherever the measure runs out. It is two sentences and it should
              look like two. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: k(58),
            }}
          >
            <div style={{ display: "flex", fontSize: k(88), fontWeight: 400, color: dark ? "rgba(255,255,255,0.82)" : "rgba(23,18,58,0.72)" }}>
              Find your people.
            </div>
            <div style={{ display: "flex", fontSize: k(88), fontWeight: 400, color: dark ? "rgba(255,255,255,0.82)" : "rgba(23,18,58,0.72)", marginTop: k(10) }}>
              Build real connections.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: k(60),
              fontWeight: 700,
              color: up,
              marginTop: k(110),
              letterSpacing: "0.02em",
            }}
          >
            linkupnaija.com
          </div>
        </div>
      ),
      { width: PW, height: PH, fonts }
    );
  }

  const stacked = variant === "stacked";

  /**
   * Proportions are fixed to the width, not chosen per variant.
   *
   * The mark is 0.3 of the lockup width horizontally and 0.34 stacked, and
   * the type is set from the same number. That is what stops the two lockups
   * drifting into different-looking logos the first time somebody asks for a
   * taller one.
   */
  const mark = Math.round(W * (stacked ? 0.34 : 0.3));
  const type = Math.round(W * (stacked ? 0.155 : 0.175));
  const gap = Math.round(W * (stacked ? 0.045 : 0.05));
  const H = stacked ? Math.round(mark + gap + type * 1.35) : Math.round(mark * 1.08);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap,
          backgroundColor: background,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_MARK_DATA_URI} alt="" width={mark} height={mark} style={{ width: mark, height: mark }} />
        <div
          style={{
            display: "flex",
            fontSize: type,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: ink,
          }}
        >
          Link<span style={{ color: up }}>Up</span>Naija
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
