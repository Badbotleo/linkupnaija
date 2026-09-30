import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { SITE_ORIGIN } from "@/lib/qr";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The pull-up banner. 800 × 2000 mm, the standard Nigerian roll-up.
 *
 * It advertises LinkUpNaija, not the party it is standing at. A banner beside
 * a jollof queue has one job: the person reading it is already out, already
 * enjoying themselves, and is the exact person who should be on the platform.
 * So it sells the thing they can take home, and the QR is the whole point of
 * the object.
 *
 * WHAT GOES WHERE IS NOT DECORATION. A roll-up is read standing up, from
 * about a metre and a half:
 *
 *   The bottom 150mm sits at or below knee height and is often behind the
 *   cassette or a passing leg, so nothing that matters lives there.
 *   The top 250mm is above most eye lines and is for the mark alone.
 *   The middle third is the only part anyone actually reads, so the promise
 *   and the QR both sit in it.
 *
 * ?w= sets the pixel width and the height follows at 2:5. Default 1600,
 * which is ~50 dpi at full size: fine for a roll-up read from a distance, and
 * what most Lagos print shops accept. Ask for more if yours wants 100 dpi
 * (?w=3150) and give it a minute.
 *
 * The QR is rendered to SVG on the server and passed in as a data URI.
 * Satori will not render arbitrary SVG children, but it will place an <img>,
 * and an SVG data URI stays sharp at whatever size the banner is printed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAROON = "#3D0A0E";
const MAROON_2 = "#5A1116";
const GOLD = "#F0B849";
const CREAM = "#FFF3E0";

/** What the platform is for, in the words a stranger would use. */
const PROMISES = [
  ["Something on every week", "Parties, game nights, picnics, hikes, dinners"],
  ["The host approves every guest", "It is never a room full of randos"],
  ["See who is coming before you go", "Real profiles, real people, no surprises"],
  ["Free to join", "Pay only when an event has a ticket"],
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const W = Math.min(4000, Math.max(600, Number(url.searchParams.get("w")) || 1600));
  const H = Math.round(W * 2.5);
  const u = (n: number) => Math.round((n / 1600) * W); // scale from the 1600 design

  /**
   * A QR encoded on the server, not by the React component.
   *
   * qrcode.react is a client component built on hooks, and rendering it in a
   * route handler dies on "Cannot read properties of null (reading
   * 'useMemo')" because there is no React dispatcher here. Next also refuses
   * a static react-dom/server import anywhere under app/. Both are the
   * framework correctly objecting to rendering a browser component on a PNG
   * pipeline, so this uses the plain encoder instead.
   *
   * Error correction H: a banner picks up dust, creases and a fingerprint
   * within a week, and H survives about 30% of the code being unreadable.
   * Output is SVG, so it stays exact at any print size.
   */
  const qrSvg = await QRCode.toString(SITE_ORIGIN, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: MAROON, light: "#ffffff" },
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
          alignItems: "center",
          backgroundColor: MAROON,
          backgroundImage: `linear-gradient(170deg, ${MAROON_2} 0%, ${MAROON} 60%)`,
          paddingTop: u(150),
          paddingLeft: u(110),
          paddingRight: u(110),
          paddingBottom: u(150),
        }}
      >
        {/* The flag rule, the one constant across everything we print. */}
        <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: `${W}px` }}>
          <div style={{ display: "flex", width: `${W / 3}px`, height: `${u(22)}px`, backgroundColor: "#008753" }} />
          <div style={{ display: "flex", width: `${W / 3}px`, height: `${u(22)}px`, backgroundColor: "#FFFFFF" }} />
          <div style={{ display: "flex", width: `${W / 3}px`, height: `${u(22)}px`, backgroundColor: "#008753" }} />
        </div>

        {/* ------------------------------------------------- the mark ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: u(28) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={u(150)} height={u(150)} style={{ width: u(150), height: u(150) }} />
          <div style={{ display: "flex", fontSize: u(96), fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
            Link<span style={{ color: "#8B83E6" }}>Up</span>Naija
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: u(34),
            fontSize: u(46),
            fontWeight: 400,
            color: GOLD,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          Nigeria&apos;s social events platform
        </div>

        {/* --------------------------------------------- the promise ---- */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: u(90) }}>
          <div style={{ display: "flex", fontSize: u(128), fontWeight: 700, color: CREAM, letterSpacing: "-0.03em" }}>
            Find your
          </div>
          <div style={{ display: "flex", fontSize: u(128), fontWeight: 700, color: GOLD, letterSpacing: "-0.03em", marginTop: u(-14) }}>
            people.
          </div>
        </div>

        {/* ------------------------------------------- what you get ---- */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: u(80), gap: u(30) }}>
          {PROMISES.map(([head, sub]) => (
            <div key={head} style={{ display: "flex", alignItems: "flex-start", gap: u(24) }}>
              <div
                style={{
                  display: "flex",
                  width: u(20),
                  height: u(20),
                  borderRadius: u(10),
                  backgroundColor: GOLD,
                  marginTop: u(18),
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: u(52), fontWeight: 700, color: CREAM }}>{head}</div>
                <div style={{ display: "flex", fontSize: u(36), fontWeight: 400, color: "rgba(255,243,224,0.66)", marginTop: u(4) }}>
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --------------------------------------------- what's on ---- */}
        {/* The reference roll-up this was modelled on fills its middle with
            a grid of what the business sells, and it is right to: on a
            2-metre banner the middle third is chest height and the only part
            read at a glance. Naming the categories does more than an
            abstract promise, because somebody recognises the one they want. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: u(70) }}>
          <div
            style={{
              display: "flex",
              fontSize: u(42),
              fontWeight: 700,
              color: GOLD,
              letterSpacing: "0.14em",
            }}
          >
            WHAT&apos;S ON
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: u(16),
              marginTop: u(28),
            }}
          >
            {[
              "Parties",
              "Game nights",
              "Picnics",
              "Concerts",
              "Hikes",
              "Karaoke",
              "Dinners",
              "Beach days",
              "Road trips",
              "Book clubs",
            ].map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  borderRadius: u(999),
                  border: `${u(3)}px solid rgba(240,184,73,0.45)`,
                  paddingTop: u(14),
                  paddingBottom: u(14),
                  paddingLeft: u(30),
                  paddingRight: u(30),
                  fontSize: u(38),
                  fontWeight: 700,
                  color: CREAM,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------- the QR ---- */}
        {/* CHEST HEIGHT, NOT THE FOOT OF THE BANNER. Pinned to the bottom it
            printed about 30cm off the floor, and a code down there is scanned
            by crouching, which nobody does at a party holding a plate. It now
            sits around 1.2m up, which is where a phone already is. The URL
            and the handle take the bottom, where being low costs nothing
            because they are read, not used. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: u(80),
          }}
        >
          <div style={{ display: "flex", fontSize: u(60), fontWeight: 700, color: GOLD, marginBottom: u(28) }}>
            Point your camera here
          </div>
          <div
            style={{
              display: "flex",
              padding: u(30),
              borderRadius: u(40),
              backgroundColor: "#ffffff",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="" width={u(620)} height={u(620)} style={{ width: u(620), height: u(620) }} />
          </div>
          <div style={{ display: "flex", fontSize: u(44), fontWeight: 400, color: "rgba(255,243,224,0.75)", marginTop: u(26) }}>
            Free to join. Takes a minute.
          </div>
        </div>

        {/* ---------------------------------------------- the footer ---- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              height: u(3),
              width: u(420),
              backgroundColor: "rgba(255,243,224,0.22)",
              marginBottom: u(30),
            }}
          />
          <div style={{ display: "flex", fontSize: u(72), fontWeight: 700, color: "#fff" }}>
            linkupnaija.com
          </div>
          <div style={{ display: "flex", fontSize: u(40), fontWeight: 400, color: "rgba(255,243,224,0.6)", marginTop: u(14) }}>
            @officiallinkupnaija
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
