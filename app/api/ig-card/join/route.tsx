import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The growth cards. Six posts that do NOT look like one post.
 *
 * The first version was a template: one dark ground, one gold pill, one big
 * white sentence, six times. Laid out in a profile grid it read as a single
 * card posted repeatedly, which is exactly how an account teaches people to
 * scroll past it. The sentence was the only variable, so the sentence was
 * doing all the work and the design was doing none.
 *
 * Each hook now gets a SCENE built out of the thing it is talking about. The
 * chat card is chat bubbles. The request card is a join request. The map card
 * is a radar. A person should be able to tell them apart in a grid at
 * thumbnail size with the text unreadable, which is the actual test.
 *
 * WHAT STAYS CONSTANT is deliberately small: the flag rule and the logo. Those
 * are the brand. Everything else, ground colour included, belongs to the post.
 *
 * THE PALETTE IS THE AUDIENCE. Young, going out, on a phone at night. It runs
 * rose and cobalt alternating down the set, with the brand violet and a warm
 * gold holding the middle, so a profile grid reads as somebody's night out
 * rather than a B2B deck. The first version was six shades of dark and looked
 * like a fintech.
 *
 * ONE PINK, not two. Six cards carrying two rose grounds made the grid read
 * pink overall, which is a narrower signal than the audience actually is. The
 * dots card took the naija green instead, which also puts the flag's colour
 * somewhere other than the rule at the top.
 *
 * DEEP, NOT FLUORESCENT. The pass before this used #FF3D8B and #1746E3 at full
 * chroma across the whole 1080, which glared: a saturated ground at that size
 * is not an accent any more, it is the light in the room, and the person
 * looking at it is in bed. These are the same two hues walked down in
 * saturation and lightness, which keeps the identity and stops the shouting.
 *
 * ?v=0..5 pins one. Anything else rotates by the day.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;
const PAD = 60;

/* ------------------------------------------------------------- helpers -- */

function Flag() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        display: "flex",
        width: `${SIZE}px`,
      }}
    >
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#008753" }} />
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#FFFFFF" }} />
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#008753" }} />
    </div>
  );
}

function Wordmark({ on }: { on: "dark" | "light" }) {
  const fg = on === "dark" ? "#fff" : "#121212";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_MARK_DATA_URI} alt="" width={46} height={46} style={{ width: 46, height: 46 }} />
      <div
        style={{
          display: "flex",
          fontSize: 31,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: fg,
        }}
      >
        Link<span style={{ color: on === "dark" ? "#8B83E6" : "#534AB7" }}>Up</span>Naija
      </div>
    </div>
  );
}

/**
 * The closing line. Same words every time, so it can look the same.
 *
 * Takes its colours from the scene rather than deriving them from a
 * dark/light flag. On a saturated ground neither black nor white is simply
 * "correct": hot pink wants a black headline and a WHITE secondary, and
 * dropping the opacity of black on pink produces mud.
 */
function Foot({ fg, fg2, note }: { fg: string; fg2: string; note: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 27,
        fontWeight: 700,
        color: fg,
      }}
    >
      <div style={{ display: "flex" }}>linkupnaija.com</div>
      <div style={{ display: "flex", fontWeight: 500, color: fg2 }}>{note}</div>
    </div>
  );
}

/**
 * Drawn, not typed.
 *
 * The bundled face is Noto Sans latin-ext, which is there for the naira sign
 * and stops not far past it. U+2713 CHECK MARK and U+25AE BLACK VERTICAL
 * RECTANGLE both fell through to tofu, which is the same failure og-fonts.ts
 * documents for the currency symbol. Anything that is a shape rather than a
 * word gets built out of divs so no font has to have it.
 */
function Tick({ color }: { color: string }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 26,
        height: 26,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          display: "flex",
          width: 10,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          transform: "translate(-6px, 3px) rotate(45deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          width: 20,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          transform: "translate(2px, 0px) rotate(-45deg)",
        }}
      />
    </div>
  );
}

/** The message you cannot read, as bars rather than a censored glyph. */
function Redacted() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {[92, 54, 130, 68].map((w, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: w,
            height: 20,
            borderRadius: 6,
            backgroundColor: "rgba(255,255,255,0.22)",
          }}
        />
      ))}
    </div>
  );
}

function Bubble({
  text,
  mine,
  muted,
}: {
  text: string;
  mine?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "660px",
        padding: "20px 26px",
        borderRadius: 26,
        backgroundColor: mine ? "#2E7D5B" : "#26325C",
        fontSize: 31,
        lineHeight: 1.3,
        color: muted ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.94)",
      }}
    >
      {text}
    </div>
  );
}

/* -------------------------------------------------------------- scenes -- */

interface Scene {
  ground: string;
  /** Headline colour. */
  fg: string;
  /** Supporting text. On a vivid ground this is usually white, not a
      faded version of the headline, which only ever reads as dirt. */
  fg2: string;
  /** Which logo lockup reads on this ground. */
  on: "dark" | "light";
  note: string;
  art: React.ReactNode;
  copy: React.ReactNode;
}

function scenes(): Scene[] {
  return [
    /* 0 ── the problem, drawn as the group chat you are not in ----------- */
    {
      ground: "#141F42",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.66)",
      on: "dark",
      note: "Find your people",
      art: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Bubble text="Pool party Saturday, my place 🎉" />
          <Bubble text="I’m in" mine />
          <Bubble text="Same, bringing two people" />
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              maxWidth: "660px",
              padding: "20px 26px",
              borderRadius: 26,
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "2px dashed rgba(255,255,255,0.22)",
            }}
          >
            <Redacted />
          </div>
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.04,
              color: "#fff",
            }}
          >
            You were never added to the group.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 30,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            That is the only reason you missed it.
          </div>
        </div>
      ),
    },

    /* 1 ── how it works, drawn as the actual request card ---------------- */
    {
      ground: "#B84A6F",
      fg: "#151020",
      fg2: "rgba(255,255,255,0.95)",
      on: "light",
      note: "Ask to join",
      art: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "40px 42px",
            borderRadius: 34,
            backgroundColor: "#fff",
            border: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "#534AB7",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              AD
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#121212" }}>
                Amaka D.
              </div>
              <div style={{ display: "flex", marginTop: 4, fontSize: 27, color: "#6B6785" }}>
                wants to join Games Night
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                justifyContent: "center",
                padding: "20px 0",
                borderRadius: 999,
                backgroundColor: "#4A42A3",
                fontSize: 30,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Let them in
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                justifyContent: "center",
                padding: "20px 0",
                borderRadius: 999,
                border: "2px solid #DBD6EC",
                fontSize: 30,
                fontWeight: 700,
                color: "#6B6785",
              }}
            >
              Not this time
            </div>
          </div>
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "#151020",
            }}
          >
            A person decides. Every time.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 30,
              fontWeight: 500,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            Not a public party. The host sees who is coming before anyone turns up.
          </div>
        </div>
      ),
    },

    /* 2 ── the host's chores, struck through ----------------------------- */
    {
      ground: "#31509B",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.74)",
      on: "dark",
      note: "Hosting is free",
      art: (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            "Chase 9 people for money",
            "Recount the heads, again",
            "Send the location a 4th time",
            "Handle the 6pm cancellations",
          ].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  display: "flex",
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "3px solid #9DB4E8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Tick color="#D6E1F7" />
              </div>
              <div style={{ display: "flex", position: "relative" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 38,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    textDecoration: "line-through",
                  }}
                >
                  {t}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.03,
              color: "#fff",
            }}
          >
            {"Post it once. Stop being the group chat\u2019s admin."}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 30,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Tickets, reminders and the guest list handle themselves.
          </div>
        </div>
      ),
    },

    /* 3 ── four people you know, in a city of dots ----------------------- */
    {
      ground: "#1E4A3A",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.74)",
      on: "dark",
      note: "New in town?",
      art: (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: "100%",
            gap: 20,
          }}
        >
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: i < 4 ? "#F0CE8E" : "#FFFFFF",
                opacity: i < 4 ? 1 : 0.26,
              }}
            />
          ))}
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.03,
              color: "#fff",
            }}
          >
            You moved to Lagos and you know four people.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 30,
              fontWeight: 500,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            Three of them are from work.
          </div>
        </div>
      ),
    },

    /* 4 ── what is on, drawn as a radius around you ---------------------- */
    {
      ground: "#1B1638",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.66)",
      on: "dark",
      note: "Open the app and look",
      art: (
        <div
          style={{
            display: "flex",
            position: "relative",
            width: "100%",
            height: "380px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[380, 280, 180].map((d, i) => (
            <div
              key={d}
              style={{
                position: "absolute",
                display: "flex",
                width: d,
                height: d,
                borderRadius: d / 2,
                border: "2px solid #C98BA8",
                opacity: 0.18 + i * 0.1,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              display: "flex",
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: "#fff",
            }}
          />
          {[
            { t: "Brunch", x: -250, y: -110 },
            { t: "Game night", x: 170, y: -140 },
            { t: "Pool party", x: -290, y: 90 },
            { t: "Bonfire", x: 200, y: 110 },
          ].map((p) => (
            <div
              key={p.t}
              style={{
                position: "absolute",
                display: "flex",
                transform: `translate(${p.x}px, ${p.y}px)`,
                padding: "12px 22px",
                borderRadius: 999,
                backgroundColor: "#B84A6F",
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {p.t}
            </div>
          ))}
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.03,
              color: "#fff",
            }}
          >
            Something is on tonight, 5km from you.
          </div>
        </div>
      ),
    },

    /* 5 ── the empty seat ------------------------------------------------ */
    {
      ground: "#E3BE86",
      fg: "#151020",
      fg2: "rgba(21,16,32,0.66)",
      on: "light",
      note: "Bring somebody",
      art: (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: i === 4 ? "transparent" : "#121212",
                  border: i === 4 ? "4px dashed rgba(18,18,18,0.35)" : "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 116,
                  height: 132,
                  borderTopLeftRadius: 58,
                  borderTopRightRadius: 58,
                  backgroundColor: i === 4 ? "transparent" : "#121212",
                  border: i === 4 ? "4px dashed rgba(18,18,18,0.35)" : "none",
                }}
              />
            </div>
          ))}
        </div>
      ),
      copy: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "#121212",
            }}
          >
            Going alone is why you did not go.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 30,
              color: "rgba(18,18,18,0.62)",
            }}
          >
            So bring one person. Leave with five.
          </div>
        </div>
      ),
    },
  ];
}

/* ---------------------------------------------------------------- route -- */

export async function GET(req: Request) {
  const all = scenes();
  const raw = Number(new URL(req.url).searchParams.get("v"));
  const day = Math.floor(Date.now() / 86_400_000);
  const i =
    Number.isInteger(raw) && raw >= 0 && raw < all.length
      ? raw
      : day % all.length;
  const s = all[i];
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor: s.ground,
          padding: `${PAD + 10}px ${PAD}px ${PAD}px`,
        }}
      >
        <Flag />

        <Wordmark on={s.on} />

        {/* The art takes the room that is left and sits in the middle of it.
            Pinned to the top it left a hole between the picture and the
            sentence, which read as a layout that had lost something. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 28,
            paddingBottom: 28,
          }}
        >
          {s.art}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {s.copy}
          <Foot fg={s.fg} fg2={s.fg2} note={s.note} />
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );
}
