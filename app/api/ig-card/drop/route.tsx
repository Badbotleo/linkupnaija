import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The feature drop carousel.
 *
 * ?v=cover|going|people|home|door, ?ratio=story for the 1080x1920 cut.
 *
 * THE FIRST VERSION OF THIS WAS THE PROBLEM IT WAS MEANT TO SOLVE. Five
 * identical frames: gold pill top-left, two-line headline, grey paragraph, a
 * white box floating in the middle of a violet gradient, footer. That is the
 * eyebrow-headline-subhead-screenshot shape every generated landing page has,
 * repeated five times, and it read exactly as what it was. The UI in the
 * middle was grey rectangles standing in for artwork, on a platform holding
 * hundreds of real flyers.
 *
 * So: real covers out of the database, a different layout and a different
 * ground colour on every slide, and copy somebody would say out loud rather
 * than write in a release note. A carousel is five posts that have to survive
 * being seen one at a time; a template is a deck.
 *
 * ONLY WHAT IS LIVE. Mutual friends and Google reviews are both written and
 * both dormant, one waiting on a migration and the other on an API key.
 * Announcing either sends people to open the app and fail to find it.
 *
 * SATORI, AGAIN. No WebP: it decodes to nothing, silently, and several of our
 * covers are WebP, so they are filtered by content type rather than hoped
 * about. Nothing clips. Every element with children carries display:flex.
 * Anything pointing is drawn, because the typed arrows are tofu here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "#0B0B0F";
const BRAND = "#534AB7";
const BRAND_DEEP = "#2A2468";
const GOLD = "#FAC775";
const GREEN = "#0A5C2E";
const PAPER = "#FBFBFD";

/* ------------------------------------------------------------------ */

const imgCache = new Map<string, string | null>();

/**
 * A remote cover, as a data URI Satori can actually draw.
 *
 * Content type is checked rather than the extension, because WebP renders as
 * nothing at all and about a third of our covers are WebP. A miss returns
 * null and the caller draws a colour field, which is why no slide depends on
 * any particular event existing.
 */
async function inlineImage(raw: string | null | undefined): Promise<string | null> {
  if (!raw || !/^https:\/\/\S+$/i.test(raw.trim())) return null;
  const key = raw.trim();
  if (imgCache.has(key)) return imgCache.get(key)!;
  try {
    const r = await fetch(key, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      imgCache.set(key, null);
      return null;
    }
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!["image/png", "image/jpeg"].includes(type)) {
      imgCache.set(key, null);
      return null;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > 2_500_000) {
      imgCache.set(key, null);
      return null;
    }
    const src = `data:${type};base64,${buf.toString("base64")}`;
    imgCache.set(key, src);
    return src;
  } catch {
    imgCache.set(key, null);
    return null;
  }
}

interface Cover {
  title: string;
  state: string | null;
  location: string | null;
  src: string | null;
}

/**
 * Cut on a word boundary.
 *
 * Slicing at a character count gave "The Becoming Circle Hang" and "NEXT GENX
 * Presented by Spa", which reads as a bug rather than as a title that did not
 * fit. Three dots rather than the ellipsis character: U+2026 is outside the
 * subset these fonts carry and would render as tofu.
 */
function clip(s: string, n: number): string {
  const clean = s.trim();
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  const space = cut.lastIndexOf(" ");
  return (space > n * 0.55 ? cut.slice(0, space) : cut).replace(/[,:;-]$/, "") + "...";
}

/** Real upcoming events, their covers inlined, WebP dropped on the way. */
async function covers(n: number): Promise<Cover[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select("title, state, location, cover_image_url")
    .eq("event_type", "general")
    .gte("date", today)
    .not("cover_image_url", "is", null)
    .order("date", { ascending: true })
    .limit(n * 3);

  const rows = (data ?? []) as {
    title: string;
    state: string | null;
    location: string | null;
    cover_image_url: string;
  }[];

  const out: Cover[] = [];
  for (const r of rows) {
    if (out.length >= n) break;
    const src = await inlineImage(r.cover_image_url);
    if (!src) continue;
    out.push({ title: r.title, state: r.state, location: r.location, src });
  }
  return out;
}

/* ------------------------------------------------------------------ */

/** Overlapping drawn faces. The recurring motif, and the only one. */
function faces(t: (n: number) => number, n: number, size: number, ring = PAPER) {
  const SKIN = ["#8D5524", "#A9713B", "#5C3317", "#7A4520", "#6B3E1E"];
  const HAIR = ["#1B1210", "#2B1B12", "#3A2317", "#121212", "#241711"];
  const BG = ["#EDEBFA", "#E6F4ED", "#FDF2E3", "#FBE9EF", "#E7F0FB"];
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            marginLeft: i === 0 ? 0 : -t(size * 0.26),
            borderRadius: t(size),
            border: `${Math.max(2, t(size * 0.06))}px solid ${ring}`,
          }}
        >
          <svg width={t(size)} height={t(size)} viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="32" fill={BG[i % BG.length]} />
            <ellipse cx="32" cy="60" rx="19" ry="15" fill={SKIN[i % SKIN.length]} />
            <circle cx="32" cy="27" r="13" fill={SKIN[i % SKIN.length]} />
            <path
              d="M19 26a13 13 0 0 1 26 0c0 1-1 1-2 0-3-4-8-5-11-5s-8 1-11 5c-1 1-2 1-2 0z"
              fill={HAIR[i % HAIR.length]}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

/** A flyer, or a colour field when the flyer would not decode. */
function flyer(
  src: string | null,
  w: number,
  h: number,
  radius: number,
  tint = BRAND
) {
  if (!src) {
    return (
      <div
        style={{
          display: "flex",
          width: w,
          height: h,
          borderRadius: radius,
          background: `linear-gradient(135deg, ${tint} 0%, ${BRAND_DEEP} 100%)`,
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={w}
      height={h}
      style={{ width: w, height: h, borderRadius: radius, objectFit: "cover" }}
    />
  );
}

function wordmark(t: (n: number) => number, colour: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: t(14) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_MARK_DATA_URI} width={t(46)} height={t(46)} alt="" />
      <div
        style={{
          display: "flex",
          fontSize: t(25),
          fontWeight: 700,
          color: colour,
          letterSpacing: t(2),
        }}
      >
        LINKUPNAIJA
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const story = url.searchParams.get("ratio") === "story";
  const W = 1080;
  const H = story ? 1920 : 1350;
  const t = (n: number) => Math.round(n * (W / 1080));
  const v = (n: number) => Math.round(n * (H / 1350));
  const fonts = await ogFonts();
  const want = url.searchParams.get("v") ?? "cover";

  const pics = await covers(6);
  const pic = (i: number) => pics[i % Math.max(1, pics.length)]?.src ?? null;

  /* ---------------- COVER: flyers wall, type punched over ---------- */
  if (want === "cover") {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            position: "relative",
            background: INK,
            fontFamily: "Noto Sans",
          }}
        >
          {/* A BAND, NOT A BACKDROP.
              The first cut laid the headline straight over six flyers with a
              scrim on top. That is the stock "text over busy photo" move, the
              type fought six competing posters for attention, and the word
              sitting on a seam looked like an accident. Here the flyers own
              the top half outright, at full strength, and the type owns the
              bottom half on solid ink. Both get to be loud without arguing. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: Math.round(H * 0.52),
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex" }}>
                {flyer(pic(i), W / 3, Math.round(H * 0.52), 0, i % 2 ? BRAND_DEEP : BRAND)}
              </div>
            ))}
          </div>

          {/* Just enough shade at the very top for the wordmark to sit on,
              and a short fade into the ink so the edge is a transition
              rather than a cut line. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: Math.round(H * 0.52),
              background:
                "linear-gradient(180deg, rgba(11,11,15,0.78) 0%, rgba(11,11,15,0.12) 26%, rgba(11,11,15,0.08) 74%, rgba(11,11,15,1) 100%)",
            }}
          />

          {/* The type layer. Padding pushes it into the lower half so it
              never lands on a flyer. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              padding: t(80),
            }}
          >
            <div style={{ display: "flex", marginBottom: "auto" }} />

            {/* The motif leads into the line rather than trailing after it:
                four faces, then "you no go enter alone". */}
            <div style={{ display: "flex", marginBottom: v(26) }}>
              {faces(t, 4, 70, INK)}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: t(112),
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 1.0,
                }}
              >
                You no go
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(112),
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 1.0,
                }}
              >
                enter alone
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(112),
                  fontWeight: 700,
                  color: GOLD,
                  lineHeight: 1.0,
                }}
              >
                again.
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(34),
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.72)",
                  marginTop: v(32),
                }}
              >
                Four things changed this month. Swipe.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: v(44),
              }}
            >
              {wordmark(t, "rgba(255,255,255,0.78)")}
              <div
                style={{
                  display: "flex",
                  fontSize: t(27),
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                @officiallinkupnaija
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ---------------- GOING: one flyer, faces stuck on it ------------ */
  if (want === "going") {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            background: INK,
            padding: t(76),
            fontFamily: "Noto Sans",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(82),
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.04,
            }}
          >
            See who dey go.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(82),
              fontWeight: 700,
              color: GOLD,
              lineHeight: 1.04,
            }}
          >
            Before you go.
          </div>

          <div
            style={{
              display: "flex",
              position: "relative",
              marginTop: v(46),
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            {flyer(pic(2), t(700), v(620), t(36))}
            {/* The faces sit ON the flyer like a sticker, not under it in a
                caption. That is the whole feature in one gesture. */}
            <div
              style={{
                display: "flex",
                position: "absolute",
                alignItems: "center",
                gap: t(18),
                bottom: v(-30),
                paddingLeft: t(28),
                paddingRight: t(34),
                paddingTop: t(20),
                paddingBottom: t(20),
                borderRadius: t(100),
                background: PAPER,
                boxShadow: `0 ${t(26)}px ${t(50)}px rgba(0,0,0,0.5)`,
              }}
            >
              {faces(t, 3, 62)}
              <div
                style={{
                  display: "flex",
                  fontSize: t(30),
                  fontWeight: 700,
                  color: INK,
                }}
              >
                Tobi and 2 others are going
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: t(33),
              fontWeight: 400,
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.45,
              marginTop: v(72),
            }}
          >
            Your people&apos;s faces now sit on the event itself. If Tobi is
            going, you see Tobi.
          </div>

          <div style={{ display: "flex", marginTop: "auto" }}>
            {wordmark(t, "rgba(255,255,255,0.5)")}
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ---------------- PEOPLE: gold ground, the opposite of the rest --- */
  if (want === "people") {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            background: GOLD,
            padding: t(76),
            fontFamily: "Noto Sans",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(86),
              fontWeight: 700,
              color: INK,
              lineHeight: 1.04,
            }}
          >
            You met them.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(86),
              fontWeight: 700,
              color: BRAND,
              lineHeight: 1.04,
            }}
          >
            Now add them.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(33),
              fontWeight: 400,
              color: "rgba(11,11,15,0.66)",
              lineHeight: 1.45,
              marginTop: v(26),
              maxWidth: t(860),
            }}
          >
            We stopped suggesting strangers. Your friends page shows the people
            who were at the same link-up as you.
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: t(20),
              marginTop: v(40),
            }}
          >
            {[
              ["Ada N.", pics[0]?.title ?? "Gamathon 26"],
              ["Chidi O.", pics[1]?.title ?? "Abacha Festival"],
              ["Zainab M.", pics[2]?.title ?? "Iri Ji Festival"],
            ].map(([who, where], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: t(22),
                  padding: t(24),
                  borderRadius: t(28),
                  background: PAPER,
                }}
              >
                {faces(t, 1, 78)}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: t(34),
                      fontWeight: 700,
                      color: INK,
                    }}
                  >
                    {who}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: t(24),
                      fontWeight: 400,
                      color: "#6B6B78",
                      marginTop: t(4),
                    }}
                  >
                    You were both at {clip(String(where), 26)}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    paddingLeft: t(30),
                    paddingRight: t(30),
                    paddingTop: t(15),
                    paddingBottom: t(15),
                    borderRadius: t(100),
                    background: BRAND,
                    fontSize: t(27),
                    fontWeight: 700,
                    color: "#FFFFFF",
                  }}
                >
                  Add
                </div>
              </div>
            ))}
          </div>

          {/* Closes the slide instead of leaving a third of it empty, and
              it stays true however the numbers move. */}
          <div
            style={{
              display: "flex",
              fontSize: t(30),
              fontWeight: 700,
              color: "rgba(11,11,15,0.72)",
              marginBottom: v(26),
            }}
          >
            Been to one link-up? Somebody from it is on your page already.
          </div>
          <div style={{ display: "flex" }}>
            {wordmark(t, "rgba(11,11,15,0.55)")}
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ---------------- HOME: real covers as a feed -------------------- */
  if (want === "home") {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            background: `linear-gradient(165deg, ${BRAND} 0%, ${BRAND_DEEP} 100%)`,
            padding: t(76),
            fontFamily: "Noto Sans",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(84),
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.04,
            }}
          >
            Your home page
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(84),
              fontWeight: 700,
              color: GOLD,
              lineHeight: 1.04,
            }}
          >
            sabi you now.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(33),
              fontWeight: 400,
              color: "rgba(255,255,255,0.74)",
              lineHeight: 1.45,
              marginTop: v(26),
              maxWidth: t(860),
            }}
          >
            One feed. What&apos;s near you, what&apos;s your vibe, and what your
            paddies already said yes to.
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: t(18),
              marginTop: v(36),
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: t(24),
                  padding: t(22),
                  borderRadius: t(30),
                  background: PAPER,
                }}
              >
                {flyer(pic(i + 3), t(128), t(128), t(24))}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: t(12) }}
                  >
                    {i === 0 ? faces(t, 2, 44) : null}
                    <div
                      style={{
                        display: "flex",
                        fontSize: t(25),
                        fontWeight: 700,
                        color: i === 0 ? BRAND : "#6B6B78",
                      }}
                    >
                      {
                        [
                          "Ada is going",
                          // The real state of the flyer beside it. It said
                          // "In Lagos" next to an Abuja event, which is the
                          // promo contradicting itself on one row.
                          pics[i + 3]?.state
                            ? `In ${pics[i + 3]!.state!.replace(/^FCT\s*-\s*/, "")}, soon`
                            : "Near you, soon",
                          "Filling up fast",
                        ][i]
                      }
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: t(34),
                      fontWeight: 700,
                      color: INK,
                      marginTop: t(6),
                    }}
                  >
                    {clip(pics[i + 3]?.title ?? "A link-up near you", 24)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", marginTop: "auto" }}>
            {wordmark(t, "rgba(255,255,255,0.5)")}
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  /* ---------------- DOOR: green, the odd one out ------------------- */
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: GREEN,
          padding: t(76),
          fontFamily: "Noto Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: t(80),
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.05,
          }}
        >
          Stop asking
        </div>
        <div
          style={{
            display: "flex",
            fontSize: t(80),
            fontWeight: 700,
            color: GOLD,
            lineHeight: 1.05,
          }}
        >
          &quot;where exactly?&quot;
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: v(54),
            justifyContent: "center",
          }}
        >
          {flyer(pic(4), t(840), v(560), t(34), GREEN)}
          <div
            style={{
              display: "flex",
              position: "absolute",
              alignItems: "center",
              gap: t(22),
              bottom: t(24),
              left: t(24),
              right: t(24),
              padding: t(26),
              borderRadius: t(26),
              background: PAPER,
            }}
          >
            <svg width={t(54)} height={t(54)} viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s7-5.1 7-10.4A7 7 0 0 0 5 10.6C5 15.9 12 21 12 21z"
                fill={GREEN}
              />
              <circle cx="12" cy="10.4" r="2.6" fill={PAPER} />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: t(33),
                  fontWeight: 700,
                  color: INK,
                }}
              >
                {clip(
                  pics[4]?.location ?? "Mulla's Place, Wuse 2",
                  26
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(25),
                  fontWeight: 700,
                  color: GREEN,
                  marginTop: t(4),
                }}
              >
                Get directions
              </div>
            </div>
            <svg width={t(38)} height={t(38)} viewBox="0 0 24 24" fill="none">
              <path
                d="M9 5l7 7-7 7"
                stroke={GREEN}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            fontSize: t(34),
            fontWeight: 400,
            color: "rgba(255,255,255,0.8)",
            lineHeight: 1.45,
            marginTop: v(40),
          }}
        >
          Tap the address on any event. Your map opens, pointed at the door.
          No more &quot;I dey outside, which gate?&quot;
        </div>

        <div style={{ display: "flex" }}>
          {wordmark(t, "rgba(255,255,255,0.55)")}
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
