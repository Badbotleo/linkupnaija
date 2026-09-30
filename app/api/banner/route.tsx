import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { SITE_ORIGIN } from "@/lib/qr";
import { ogFonts } from "@/lib/og-fonts";

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
const HERO = "/banner/n3.jpg"; // three of them dancing, arms up
const STRIP = ["/banner/n1.jpg", "/banner/n2.jpg", "/banner/n4.jpg"];

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
        {/* ================================================== the hero ==== */}
        <div style={{ display: "flex", position: "relative", width: "100%", height: u(1500) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(HERO)}
            alt=""
            width={W}
            height={u(1500)}
            style={{ width: W, height: u(1500), objectFit: "cover" }}
          />

          {/* Carries the photograph into the headline instead of stopping at
              a hard edge. Solid at the bottom so the type below has clean
              ground; Satori has no blur, so this does the work. */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              left: 0,
              bottom: 0,
              width: W,
              height: u(640),
              backgroundImage: `linear-gradient(to top, ${INK} 0%, ${INK} 18%, rgba(22,13,51,0) 100%)`,
            }}
          />

          {/* The flag rule, the one constant across everything we print. */}
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: W }}>
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#FFFFFF" }} />
            <div style={{ display: "flex", width: W / 3, height: u(22), backgroundColor: "#008753" }} />
          </div>

          {/* The mark sits ON the photograph, not in a band above it. */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              gap: u(24),
              top: u(90),
              left: u(90),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={u(118)} height={u(118)} style={{ width: u(118), height: u(118) }} />
            <div style={{ display: "flex", fontSize: u(80), fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
              Link<span style={{ color: "#A79BFF" }}>Up</span>Naija
            </div>
          </div>
        </div>

        {/* ============================================== the headline ==== */}
        {/* Ranged left and flush to the margin. Centred type on a two metre
            banner has no spine; ranging it left gives everything below
            something to line up against. */}
        <div style={{ display: "flex", flexDirection: "column", paddingLeft: u(90), paddingRight: u(90), marginTop: u(-30) }}>
          <div style={{ display: "flex", fontSize: u(196), fontWeight: 700, color: CREAM, letterSpacing: "-0.045em", lineHeight: 1 }}>
            FIND YOUR
          </div>
          <div style={{ display: "flex", fontSize: u(196), fontWeight: 700, color: GOLD, letterSpacing: "-0.045em", lineHeight: 1 }}>
            PEOPLE.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: u(20), marginTop: u(36) }}>
            <div style={{ display: "flex", width: u(80), height: u(8), backgroundColor: ROSE, borderRadius: u(4) }} />
            <div style={{ display: "flex", fontSize: u(50), fontWeight: 400, color: "rgba(255,244,230,0.82)" }}>
              Real link-ups near you, every week
            </div>
          </div>
        </div>

        {/* ================================================ the strip ==== */}
        {/* Edge to edge, no borders, no gaps. Three photographs touching read
            as one band of a night out; three framed with space between them
            read as three separate small pictures. */}
        <div style={{ display: "flex", width: "100%", marginTop: u(64) }}>
          {STRIP.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f}
              src={img(f)}
              alt=""
              width={Math.round(W / 3)}
              height={u(640)}
              style={{ width: Math.round(W / 3), height: u(640), objectFit: "cover" }}
            />
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
