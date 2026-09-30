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

const INK = "#1B1140";      // deep violet, the brand colour walked down
const INK_2 = "#2E1C6B";
const GOLD = "#FFC93C";
const ROSE = "#FF4E8E";
const CYAN = "#3FD0E0";
const CREAM = "#FFF4E6";

/**
 * Real members at real link-ups, from the gallery on their own events.
 *
 * The first version of this banner was a list of promises on a dark ground
 * and read like a slide from a pitch deck. What a party banner needs is
 * faces: the proof is not "the host approves every guest", it is that these
 * are people who went out and had a good time, and the reader can see it
 * without reading a word.
 *
 * Chosen by eye from the seventeen images the platform holds. Most were other
 * brands' flyers, which are somebody else's artwork and say nothing about us.
 * These five have members in them.
 */
/**
 * Served from public/banner/ rather than fetched from Supabase storage.
 *
 * SATORI DOES NOT DECODE WEBP. Three of the five originals are .webp and
 * rendered as blank white cards, silently: no error, no warning, just an
 * empty polaroid where a person should be. They are converted to JPEG here
 * and kept beside the code, which also means the banner renders without a
 * round trip to storage and cannot break when a member deletes a photo.
 */
const FACES = [
  "/banner/n1.jpg", // the crowd, braids, phones up
  "/banner/n3.jpg", // three of them dancing, arms up. The hero, so it centres
  "/banner/n2.jpg", // drinks going round
  "/banner/n4.jpg", // outside, string lights, evening
  "/banner/m5.jpg", // daylight group shot, for contrast with four night scenes
];

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
   * Absolute, and versioned by the file's own modification time.
   *
   * Satori fetches every <img> over HTTP, so a relative path resolves to
   * nothing: the origin comes from the request, which works on localhost and
   * on the deployed site without a second setting to keep in step.
   *
   * THE ?v IS NOT DECORATION. Those fetches go through the fetch Next patches
   * and caches, and .next/cache survives a server restart, so re-cropping the
   * photos changed nothing on screen: the banner kept rendering the old
   * images, byte for byte identical, through two restarts. Exactly the trap
   * documented on /api/ig-card/jollof, where force-dynamic did not help
   * either, because it governs whether the ROUTE re-runs and not what the
   * fetch inside it answers with. Keying on mtime means editing a photo is
   * enough to invalidate it.
   */
  const origin = url.origin;
  const { statSync } = await import("node:fs");
  const faces = FACES.map((f) => {
    let v = "0";
    try {
      v = String(Math.round(statSync(`${process.cwd()}/public${f}`).mtimeMs));
    } catch {
      // Not on disk in this environment; the plain URL still works.
    }
    return `${origin}${f}?v=${v}`;
  });

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
          alignItems: "center",
          backgroundColor: INK,
          backgroundImage: `linear-gradient(165deg, ${INK_2} 0%, ${INK} 55%)`,
          paddingTop: u(150),
          paddingLeft: u(110),
          paddingRight: u(110),
          paddingBottom: u(150),
        }}
      >
        {/* ------------------------------------------ the background ---- */}
        {/* A FLAT GRADIENT IS A DEAD BANNER. Two metres of one colour reads
            as a conference pull-up, which is what the first two attempts
            looked like.

            Built the way your own Jollof flyer is: ghosted wordmarks running
            across the field, big soft colour blocks behind them, and confetti
            over the top. Everything sits under the content at low opacity, so
            it gives the surface life without competing with a single word.

            No blur anywhere. Satori does not implement filter, and a
            backdrop-blur that silently does nothing is how you end up with
            hard-edged circles you did not intend. These are solid shapes at
            low alpha, which is the same effect by honest means. */}
        <div style={{ position: "absolute", top: 0, left: 0, width: `${W}px`, height: `${H}px`, display: "flex" }}>
          {/* Colour blocks. Rose top left, cyan mid right, gold low left, so
              the eye travels down the banner rather than sitting still. */}
          <div style={{ position: "absolute", display: "flex", top: u(-260), left: u(-300), width: u(1100), height: u(1100), borderRadius: u(9999), backgroundColor: "rgba(255,78,142,0.15)" }} />
          <div style={{ position: "absolute", display: "flex", top: u(1500), left: u(900), width: u(1000), height: u(1000), borderRadius: u(9999), backgroundColor: "rgba(63,208,224,0.13)" }} />
          <div style={{ position: "absolute", display: "flex", top: u(2700), left: u(-420), width: u(1000), height: u(1000), borderRadius: u(9999), backgroundColor: "rgba(255,201,60,0.12)" }} />
          <div style={{ position: "absolute", display: "flex", top: u(3450), left: u(1000), width: u(900), height: u(900), borderRadius: u(9999), backgroundColor: "rgba(255,78,142,0.12)" }} />

          {/* The wordmark, ghosted and repeated, on a slant. */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={`w${i}`}
              style={{
                position: "absolute",
                display: "flex",
                top: u(120 + i * 520),
                left: i % 2 === 0 ? u(-180) : u(-460),
                fontSize: u(190),
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "rgba(255,255,255,0.045)",
                transform: "rotate(-8deg)",
                whiteSpace: "nowrap",
              }}
            >
              LINKUP NAIJA LINKUP NAIJA
            </div>
          ))}

          {/* Confetti. Placed by hand rather than at random, so a re-render
              produces the same banner and the print shop's proof matches. */}
          {(
            [
              [180, 520, 18, ROSE], [1180, 300, -24, CYAN], [640, 1180, 40, GOLD],
              [1320, 1520, -12, ROSE], [120, 1760, 32, CYAN], [1420, 2280, 16, GOLD],
              [260, 2460, -30, ROSE], [900, 2980, 24, CYAN], [1380, 3240, -18, GOLD],
              [200, 3520, 28, CYAN], [1100, 3880, -22, ROSE], [420, 4120, 14, GOLD],
              [1300, 4520, 36, CYAN], [260, 4880, -16, ROSE], [980, 5260, 22, GOLD],
              [1400, 5620, -28, ROSE], [180, 5980, 20, CYAN], [880, 6380, -14, GOLD],
              [1340, 6740, 30, ROSE], [300, 7080, -20, CYAN], [1050, 7420, 18, GOLD],
            ] as [number, number, number, string][]
          ).map(([x, y, r, colour], i) => (
            <div
              key={`c${i}`}
              style={{
                position: "absolute",
                display: "flex",
                left: u(x),
                top: u(y),
                width: u(26),
                height: u(52),
                borderRadius: u(6),
                backgroundColor: colour,
                opacity: 0.5,
                transform: `rotate(${r}deg)`,
              }}
            />
          ))}
        </div>

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: u(56) }}>
          <div style={{ display: "flex", fontSize: u(150), fontWeight: 700, color: CREAM, letterSpacing: "-0.04em", lineHeight: 1 }}>
            Find your
          </div>
          <div style={{ display: "flex", fontSize: u(150), fontWeight: 700, color: GOLD, letterSpacing: "-0.04em", lineHeight: 1 }}>
            people.
          </div>
        </div>

        {/* ------------------------------------------------ the faces ---- */}
        {/* THE PART THAT WAS MISSING. The first version put four promises in
            a bulleted list and read like a slide from a pitch deck. Nobody
            standing at a party reads a bulleted list.

            Tilted and overlapping, because a neat grid of photographs reads
            as stock and a scatter reads as a night out. The rotations are
            small and alternate so the row still sits level from across a
            room. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            marginTop: u(54),
            height: u(430),
          }}
        >
          {faces.slice(0, 3).map((src, i) => (
            <div
              key={src}
              style={{
                display: "flex",
                padding: u(14),
                backgroundColor: "#fff",
                borderRadius: u(10),
                marginLeft: i === 0 ? 0 : u(-34),
                transform: `rotate(${[-6, 2.5, 7][i]}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                width={u(370)}
                height={u(370)}
                style={{ width: u(370), height: u(370), objectFit: "cover", borderRadius: u(4) }}
              />
            </div>
          ))}
        </div>

        {/* ------------------------------------------- what you get ---- */}
        {/* Three, not four, and each one line. The fourth was "free to join",
            which now lives under the QR where it is the last thing read
            before somebody scans. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: u(50), gap: u(18) }}>
          {[
            ["The host approves every guest", ROSE],
            ["See who's coming before you go", CYAN],
            ["Something on every single week", GOLD],
          ].map(([line, colour]) => (
            <div key={line as string} style={{ display: "flex", alignItems: "center", gap: u(20) }}>
              <div
                style={{
                  display: "flex",
                  width: u(18),
                  height: u(18),
                  borderRadius: u(9),
                  backgroundColor: colour as string,
                }}
              />
              <div style={{ display: "flex", fontSize: u(54), fontWeight: 700, color: CREAM }}>
                {line as string}
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
                  paddingTop: u(14),
                  paddingBottom: u(14),
                  paddingLeft: u(32),
                  paddingRight: u(32),
                  fontSize: u(40),
                  fontWeight: 700,
                  color: INK,
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

        {/* -------------------------------------------- more of them ---- */}
        {/* The low third was empty in the first two attempts. It is below
            comfortable reading height so it carries no words, but a band of
            faces works there: it is seen rather than read, and it stops the
            bottom of a two-metre banner looking like an unfinished wall. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            marginTop: u(70),
            height: u(380),
          }}
        >
          {faces.slice(3).map((src, i) => (
            <div
              key={src}
              style={{
                display: "flex",
                padding: u(14),
                backgroundColor: "#fff",
                borderRadius: u(10),
                marginLeft: i === 0 ? 0 : u(-26),
                transform: `rotate(${[4, -5][i]}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                width={u(400)}
                height={u(320)}
                style={{ width: u(400), height: u(320), objectFit: "cover", borderRadius: u(4) }}
              />
            </div>
          ))}
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
