import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The feature drop set.
 *
 * ?v=cover|going|home|people|door, or ?v=all for a contact sheet of the lot.
 * ?ratio=story gives 1080x1920; default is 1080x1350, the tallest the feed
 * allows.
 *
 * ONLY WHAT IS ACTUALLY LIVE. Mutual friends on a profile and Google reviews
 * on a venue are both written and both dormant: one waits on a migration, the
 * other on an API key. Announcing either would be announcing a thing somebody
 * can open the app and fail to find, which costs more trust than the feature
 * was ever going to earn. They go in the next drop, after they are switched
 * on.
 *
 * TWO OF THESE ARGUE WITH EACH OTHER ON PURPOSE. "See who's going" renders
 * nothing for a member with no connections, and "the people you met" is how
 * you get connections. So they run second and third, in that order: the card
 * that shows the payoff, then the card that tells you how to unlock it. A
 * drop that led with "add your friends" would be asking for a chore.
 *
 * SATORI RULES THAT BIT US BEFORE AND STILL APPLY. Nothing clips, so every
 * card is laid out to fit rather than trusting overflow. Arrows and ticks are
 * tofu in this subset, so anything pointing is drawn. Every element with
 * children carries display:flex. No WebP anywhere.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND = "#534AB7";
const BRAND_DEEP = "#2E2873";
const GOLD = "#FAC775";
const INK = "#121212";
const PAPER = "#FBFBFD";

type Slide = {
  key: string;
  /** The small line above the headline. */
  eyebrow: string;
  headline: string;
  body: string;
  /** Drawn, per slide. */
  art: (t: (n: number) => number) => React.ReactElement;
};

/**
 * A row of overlapping faces, which is the drop's recurring motif.
 *
 * Drawn as an SVG silhouette per person rather than stacked divs. The first
 * version was a skin-coloured circle with a shoulder block sitting in the
 * bottom of it, and at 60px that read as a two-tone dot, not a person. A head
 * with space around it and shoulders cut off by the circle's edge is what the
 * eye recognises at thumbnail size.
 */
function faces(t: (n: number) => number, n: number, size: number) {
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
            border: `${Math.max(2, t(size * 0.06))}px solid ${PAPER}`,
          }}
        >
          <svg width={t(size)} height={t(size)} viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="32" fill={BG[i % BG.length]} />
            {/* Shoulders first, so the head overlaps them. */}
            <ellipse
              cx="32"
              cy="60"
              rx="19"
              ry="15"
              fill={SKIN[i % SKIN.length]}
            />
            <circle cx="32" cy="27" r="13" fill={SKIN[i % SKIN.length]} />
            {/* Hair as a cap over the top of the head, which is what makes
                one silhouette tell apart from the next at this size. */}
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

/** The app's own card, drawn, so the slide shows the thing rather than describes it. */
function phoneCard(
  t: (n: number) => number,
  opts: {
    reason?: string;
    title: string;
    meta: string;
    withFaces?: number;
    cta?: string;
  }
) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: t(760),
        borderRadius: t(40),
        background: PAPER,
        padding: t(34),
        boxShadow: `0 ${t(30)}px ${t(70)}px rgba(0,0,0,0.35)`,
      }}
    >
      {opts.reason ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: t(14),
            marginBottom: t(22),
          }}
        >
          <div
            style={{
              display: "flex",
              width: t(26),
              height: t(26),
              borderRadius: t(8),
              background: BRAND,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: t(27),
              fontWeight: 700,
              color: "#6B6B78",
            }}
          >
            {opts.reason}
          </div>
        </div>
      ) : null}

      {/* The cover. A flat field rather than a photograph: a real flyer in a
          promo card invites the reader to judge that event instead of the
          feature. */}
      <div
        style={{
          display: "flex",
          height: t(230),
          borderRadius: t(26),
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DEEP} 100%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: t(40),
          fontWeight: 700,
          color: INK,
          marginTop: t(24),
        }}
      >
        {opts.title}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: t(27),
          fontWeight: 400,
          color: "#6B6B78",
          marginTop: t(8),
        }}
      >
        {opts.meta}
      </div>

      {opts.withFaces ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: t(18),
            marginTop: t(26),
          }}
        >
          {faces(t, opts.withFaces, 60)}
          <div
            style={{
              display: "flex",
              fontSize: t(27),
              fontWeight: 700,
              color: BRAND,
            }}
          >
            {opts.cta ?? ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A chevron, drawn. The typed one is tofu in this font subset. */
function chevron(t: (n: number) => number, size: number, colour: string) {
  return (
    <svg width={t(size)} height={t(size)} viewBox="0 0 24 24" fill="none">
      <path
        d="M9 5l7 7-7 7"
        stroke={colour}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SLIDES: Slide[] = [
  {
    key: "going",
    eyebrow: "NEW",
    headline: "See who's going before you go",
    body: "Your people show up on the card now, with their faces. No more walking into a room you know nobody in.",
    // No reason line above the artwork. The real card suppresses it when
    // friends are going, because the faces row below carries the same
    // sentence and printing it twice on one card is noise. A promo that
    // shows a card the product does not actually render is a promo that
    // teaches people the wrong thing.
    art: (t) =>
      phoneCard(t, {
        title: "ITALAWA Pool Party",
        meta: "Sun, 18 Oct · Mulla's Place, Abuja",
        withFaces: 3,
        cta: "Tobi and 2 others are going",
      }),
  },
  {
    key: "home",
    eyebrow: "NEW",
    headline: "A home page that's actually yours",
    body: "One feed, sorted for you. What's near you, what matches your taste, and what your paddies already said yes to.",
    art: (t) => (
      <div style={{ display: "flex", flexDirection: "column", gap: t(20) }}>
        {[
          { r: "Ada is going", s: true },
          { r: "In Lagos, 3 days away", s: false },
          { r: "Filling up fast this week", s: false },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: t(22),
              width: t(760),
              padding: t(26),
              borderRadius: t(28),
              background: PAPER,
              opacity: 1 - i * 0.18,
            }}
          >
            <div
              style={{
                display: "flex",
                width: t(96),
                height: t(96),
                borderRadius: t(22),
                background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DEEP} 100%)`,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Faces and the sentence travel together, because that is how
                  the real card does it: the line IS the faces row, and the
                  separate reason line is suppressed when friends are going.
                  Drawing both would advertise a card we do not ship. */}
              <div
                style={{ display: "flex", alignItems: "center", gap: t(12) }}
              >
                {row.s ? faces(t, 2, 46) : null}
                <div
                  style={{
                    display: "flex",
                    fontSize: t(25),
                    fontWeight: 700,
                    color: row.s ? BRAND : "#6B6B78",
                  }}
                >
                  {row.r}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(33),
                  fontWeight: 700,
                  color: INK,
                  marginTop: t(6),
                }}
              >
                {["Gamathon 26", "Silent Rave, Ikeja", "Abacha Festival"][i]}
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "people",
    eyebrow: "NEW",
    headline: "The people you met are one tap away",
    body: "We stopped suggesting strangers. Your friends page now shows the people who were at the same link-up as you.",
    art: (t) => (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: t(760),
          borderRadius: t(40),
          background: PAPER,
          padding: t(34),
          gap: t(22),
        }}
      >
        {["You were both at Gamathon 26", "You were both at Abacha Festival"].map(
          (line, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: t(20) }}
            >
              {faces(t, 1, 84)}
              <div
                style={{ display: "flex", flexDirection: "column", flex: 1 }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: t(34),
                    fontWeight: 700,
                    color: INK,
                  }}
                >
                  {["Ada N.", "Chidi O."][i]}
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
                  {line}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: t(26),
                  paddingRight: t(26),
                  paddingTop: t(14),
                  paddingBottom: t(14),
                  borderRadius: t(100),
                  background: BRAND,
                  fontSize: t(26),
                  fontWeight: 700,
                  color: "#FFFFFF",
                }}
              >
                Add
              </div>
            </div>
          )
        )}
      </div>
    ),
  },
  {
    key: "door",
    eyebrow: "NEW",
    headline: "The venue line is the directions",
    body: "Tap the address on any event and your maps app opens, pointed at the door. No copying, no guessing which Mulla's Place.",
    art: (t) => (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: t(760),
          borderRadius: t(40),
          background: PAPER,
          padding: t(38),
          gap: t(26),
        }}
      >
        {[
          ["Sat, 18 Oct", "3:00 PM till late"],
          ["Mulla's Place, Wuse 2", "Get directions"],
        ].map(([a, b], i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: t(22) }}
          >
            <div
              style={{
                display: "flex",
                width: t(62),
                height: t(62),
                borderRadius: t(18),
                background: i === 1 ? BRAND : "#EDEDF4",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: t(34),
                  fontWeight: 700,
                  color: INK,
                }}
              >
                {a}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(25),
                  fontWeight: 700,
                  color: i === 1 ? BRAND : "#6B6B78",
                  marginTop: t(5),
                }}
              >
                {b}
              </div>
            </div>
            {i === 1 ? chevron(t, 40, BRAND) : null}
          </div>
        ))}
      </div>
    ),
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const story = url.searchParams.get("ratio") === "story";
  const W = 1080;
  const H = story ? 1920 : 1350;

  // Type and spacing scale with the canvas so the story and the feed cut are
  // the same design rather than one of them being the other stretched.
  const t = (n: number) => Math.round(n * (W / 1080));
  const v = (n: number) => Math.round(n * (H / 1350));

  const fonts = await ogFonts();
  const want = url.searchParams.get("v") ?? "cover";

  if (want === "cover") {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: t(90),
            background: `linear-gradient(150deg, ${BRAND} 0%, ${BRAND_DEEP} 62%, ${INK} 100%)`,
            fontFamily: "Noto Sans",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: t(20) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} width={t(84)} height={t(84)} alt="" />
            <div
              style={{
                display: "flex",
                fontSize: t(32),
                fontWeight: 700,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: t(3),
              }}
            >
              LINKUPNAIJA
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                paddingLeft: t(26),
                paddingRight: t(26),
                paddingTop: t(12),
                paddingBottom: t(12),
                borderRadius: t(100),
                background: GOLD,
                fontSize: t(28),
                fontWeight: 700,
                color: INK,
                letterSpacing: t(2),
              }}
            >
              OCTOBER DROP
            </div>
            <div
              style={{
                display: "flex",
                fontSize: t(128),
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1.02,
                marginTop: v(34),
              }}
            >
              Four things
            </div>
            <div
              style={{
                display: "flex",
                fontSize: t(128),
                fontWeight: 700,
                color: GOLD,
                lineHeight: 1.02,
              }}
            >
              that changed
            </div>
            <div
              style={{
                display: "flex",
                fontSize: t(38),
                fontWeight: 400,
                color: "rgba(255,255,255,0.78)",
                marginTop: v(34),
                lineHeight: 1.4,
                maxWidth: t(820),
              }}
            >
              Your home page, your explore tab, your friends list and the way
              you get to the door.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: t(16) }}>
            <div
              style={{
                display: "flex",
                fontSize: t(32),
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              Swipe
            </div>
            {chevron(t, 38, GOLD)}
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  const slide = SLIDES.find((s) => s.key === want) ?? SLIDES[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          padding: t(84),
          background: `linear-gradient(160deg, ${BRAND} 0%, ${BRAND_DEEP} 100%)`,
          fontFamily: "Noto Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: t(18) }}>
          <div
            style={{
              display: "flex",
              paddingLeft: t(22),
              paddingRight: t(22),
              paddingTop: t(9),
              paddingBottom: t(9),
              borderRadius: t(100),
              background: GOLD,
              fontSize: t(25),
              fontWeight: 700,
              color: INK,
              letterSpacing: t(2),
            }}
          >
            {slide.eyebrow}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} width={t(50)} height={t(50)} alt="" />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: t(74),
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.08,
            marginTop: v(40),
          }}
        >
          {slide.headline}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: t(32),
            fontWeight: 400,
            color: "rgba(255,255,255,0.76)",
            lineHeight: 1.45,
            marginTop: v(24),
            maxWidth: t(880),
          }}
        >
          {slide.body}
        </div>

        {/* The art sits in the space that is left, centred. Satori does not
            clip, so this is given room rather than relied on to crop. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            marginTop: v(20),
          }}
        >
          {slide.art(t)}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(28),
              fontWeight: 700,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            linkupnaija.com
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(28),
              fontWeight: 400,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            @officiallinkupnaija
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
