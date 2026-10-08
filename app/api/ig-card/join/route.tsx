import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import { doodleField } from "@/lib/doodle-field";

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
function Tick({ color, size = 26 }: { color: string; size?: number }) {
  const k = size / 26;
  const n = (v: number) => Math.round(v * k * 10) / 10;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          display: "flex",
          width: n(10),
          height: n(4),
          borderRadius: 2,
          backgroundColor: color,
          transform: `translate(${n(-6)}px, ${n(3)}px) rotate(45deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          width: n(20),
          height: n(4),
          borderRadius: 2,
          backgroundColor: color,
          transform: `translate(${n(2)}px, 0px) rotate(-45deg)`,
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

/**
 * A right arrow, as SVG.
 *
 * U+2192 is tofu in Noto Sans latin-ext for the same reason the tick and the
 * block were, which this file already learned once. A call to action whose
 * arrow is a hollow rectangle is worse than one with no arrow.
 *
 * The first attempt built it from three divs with translate+rotate, the way
 * Tick does, and came out as a squiggle: two bars eight pixels apart, each
 * with a nine pixel vertical throw once rotated, so the chevron collapsed
 * into itself. Rather than solve for the transform origin by eye, it is a
 * path. The doodle field on the banner already proves an inline SVG data
 * URI renders exactly, and a path cannot be a few pixels out.
 */
function Arrow({ color, size = 30 }: { color: string; size?: number }) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2.8" stroke-linecap="round" ` +
    `stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The button.
 *
 * The six original cards end on a quiet grey note and nothing else, which is
 * a post that argues well and then asks for nothing. Every card worth
 * copying in the reference grid closes on a pill. It is not decoration: it
 * is the difference between a thought and an instruction.
 */
function Cta({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: 16,
        padding: "20px 34px",
        borderRadius: 999,
        backgroundColor: bg,
        fontSize: 31,
        fontWeight: 700,
        color: fg,
      }}
    >
      {label}
      <Arrow color={fg} />
    </div>
  );
}

/** The small line above the headline that says what you are looking at. */
function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color }}>
      {text}
    </div>
  );
}

/* ---------------------------------------------------- scene furniture -- */
/**
 * The pieces the four newer scenes are built from.
 *
 * Each one draws a bit of the product rather than illustrating it: a guest
 * list is a guest list, a month is a month, a saved event is the row you
 * already have sitting in your dashboard. The test the header sets is that
 * somebody can tell the cards apart in a grid at thumbnail size with the
 * text unreadable, and a diagram passes that where a picture of a diagram
 * does not.
 */

/** One message, with how long ago it was. The gap IS the joke. */
function Aged({ when, text, last }: { when: string; text: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div
        style={{
          display: "flex",
          width: 118,
          justifyContent: "flex-end",
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: last ? "#FFD166" : "rgba(255,255,255,0.4)",
        }}
      >
        {when.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          padding: "20px 28px",
          borderRadius: 24,
          fontSize: 30,
          color: last ? "#0E4F57" : "rgba(255,255,255,0.92)",
          backgroundColor: last ? "#FFD166" : "rgba(255,255,255,0.1)",
          fontWeight: last ? 700 : 400,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * A face we do not have, which is a coloured disc with an initial in it.
 *
 * `ring` marks somebody you already follow. The ring is a larger disc behind
 * rather than a border, because a border changes the element's size and the
 * two highlighted faces would then sit a few pixels off the grid from all
 * the others, which is visible at this size.
 */
function Disc({ initial, tone, ring, ink }: { initial: string; tone: string; ring?: boolean; ink?: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: 136,
        height: 136,
        borderRadius: 68,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ring ? "#FFD166" : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          width: ring ? 118 : 136,
          height: ring ? 118 : 136,
          borderRadius: 68,
          backgroundColor: tone,
          alignItems: "center",
          justifyContent: "center",
          fontSize: initial.length > 1 ? 34 : ring ? 46 : 54,
          fontWeight: 700,
          color: ink ?? "#fff",
        }}
      >
        {initial}
      </div>
    </div>
  );
}

/** One day. Thursdays are filled; everything else is the paper. */
function Day({ on }: { on?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        width: 120,
        // 66, not 82. At 82 the four rows plus the headline came to more
        // than the card has, and the button drew straight over the last
        // Thursday. Satori does not clip an overflow, it overlaps it.
        height: 66,
        borderRadius: 14,
        backgroundColor: on ? "#FFD166" : "rgba(255,255,255,0.14)",
      }}
    />
  );
}

/** A saved event, and whether it is still in front of you. */
function Saved({ title, when, gone }: { title: string; when: string; gone?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "20px 26px",
        borderRadius: 20,
        backgroundColor: gone ? "rgba(18,18,18,0.07)" : "#121212",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: gone ? "rgba(18,18,18,0.3)" : "#F2C230",
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: 31,
          fontWeight: 600,
          flexGrow: 1,
          color: gone ? "rgba(18,18,18,0.45)" : "#fff",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          padding: "8px 18px",
          borderRadius: 999,
          fontSize: 23,
          fontWeight: 700,
          color: gone ? "rgba(18,18,18,0.5)" : "#121212",
          backgroundColor: gone ? "rgba(18,18,18,0.09)" : "#F2C230",
        }}
      >
        {when}
      </div>
    </div>
  );
}

/**
 * A label on the left, a figure on the right, with a rule between them.
 *
 * Does the itemised cards: the owambe receipt, the rent arithmetic, the job
 * listing. An argument made of line items reads as something somebody worked
 * out rather than something a brand asserted, which is most of why those
 * cards land.
 */
function Line({
  label,
  value,
  ink,
  faint,
  strong,
}: {
  label: string;
  value: string;
  ink: string;
  faint: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: 960 }}>
      <div style={{ display: "flex", fontSize: strong ? 36 : 32, fontWeight: strong ? 700 : 400, color: strong ? ink : faint }}>
        {label}
      </div>
      <div style={{ display: "flex", flexGrow: 1, height: 2, backgroundColor: faint, marginLeft: 20, marginRight: 20, opacity: 0.35 }} />
      <div style={{ display: "flex", fontSize: strong ? 40 : 34, fontWeight: 700, color: strong ? ink : faint }}>
        {value}
      </div>
    </div>
  );
}

/**
 * A row of a departure board.
 *
 * `home` is the one that has not left, and it is the entire card: three
 * names gone and yours still sitting there on time. Without it the post is
 * just a sad fact about emigration, which is not an advertisement for
 * anything.
 */
function Departure({ name, to, status, home }: { name: string; to: string; status: string; home?: boolean }) {
  const fg = home ? "#FFB020" : "rgba(255,255,255,0.5)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: 960,
        padding: "16px 24px",
        borderRadius: 14,
        backgroundColor: home ? "rgba(255,176,32,0.14)" : "rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ display: "flex", width: 200, fontSize: 34, fontWeight: 700, color: home ? "#fff" : "rgba(255,255,255,0.78)" }}>
        {name}
      </div>
      <div style={{ display: "flex", flexGrow: 1, fontSize: 32, fontWeight: 400, color: fg, letterSpacing: "0.04em" }}>
        {to}
      </div>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "0.12em", color: fg }}>
        {status}
      </div>
    </div>
  );
}

/** An X, for the column where the answer is no. Two bars, both centred on
    the same point, so unlike the arrow there is nothing to position. */
function Cross({ color, size = 30 }: { color: string; size?: number }) {
  const bar = Math.round(size * 0.8);
  const thick = Math.max(4, Math.round(size * 0.17));
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", display: "flex", width: bar, height: thick, borderRadius: 3, backgroundColor: color, transform: "rotate(45deg)" }} />
      <div style={{ position: "absolute", display: "flex", width: bar, height: thick, borderRadius: 3, backgroundColor: color, transform: "rotate(-45deg)" }} />
    </div>
  );
}

/**
 * A label and two columns: what the game gives you, what the city does.
 *
 * The comparison IS the argument on the Lagos Life cards, so it is a real
 * table rather than two sentences. `game` and `real` take either text or a
 * mark, because some rows are numbers and the funny ones are yes-or-no.
 */
function Versus({
  label,
  game,
  real,
  ink,
  faint,
  hi,
}: {
  label: string;
  game: React.ReactNode;
  real: React.ReactNode;
  ink: string;
  faint: string;
  hi: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: 960 }}>
      <div style={{ display: "flex", flexGrow: 1, fontSize: 33, fontWeight: 400, color: ink }}>{label}</div>
      <div style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 34, fontWeight: 700, color: faint }}>
        {game}
      </div>
      <div style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 34, fontWeight: 700, color: hi }}>
        {real}
      </div>
    </div>
  );
}

/** The two column headings above a Versus table. */
function VersusHead({ faint, hi }: { faint: string; hi: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: 960, marginBottom: 6 }}>
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 23, fontWeight: 700, letterSpacing: "0.14em", color: faint }}>
        IN GAME
      </div>
      <div style={{ display: "flex", width: 210, justifyContent: "center", fontSize: 23, fontWeight: 700, letterSpacing: "0.14em", color: hi }}>
        OUTSIDE
      </div>
    </div>
  );
}

/** A crowd, abstracted. One square per few thousand people online. */
function Dots({ color, lit }: { color: string; lit?: string }) {
  // Fixed positions, not random. A seeded scatter would be prettier and it
  // would also move every render, and these three are the point of the card.
  const chosen = new Set(["1-7", "3-15", "4-4"]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <div key={r} style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: 24 }).map((_, c) => (
            <div
              key={c}
              style={{
                display: "flex",
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: lit && chosen.has(`${r}-${c}`) ? lit : color,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** An unfilled slot in a party. Dashed, because it is waiting, not empty. */
function Slot({ size = 140 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        border: "4px dashed rgba(255,255,255,0.3)",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 40,
        fontWeight: 700,
        color: "rgba(255,255,255,0.3)",
      }}
    >
      ?
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
  /**
   * The original frame: a picture, then a sentence under it, in fixed
   * positions. Six cards share it.
   */
  art?: React.ReactNode;
  copy?: React.ReactNode;
  /**
   * Or the whole middle of the card, composed by the card itself.
   *
   * The frame above was the problem with the first four additions. Wordmark,
   * picture, sentence, foot, four times over, with the sentence always the
   * same size in the same place and a third of every card empty. Four
   * different ideas came out looking like one layout with the words swapped,
   * which is the exact failure the header of this file was written about.
   *
   * A card with a `body` places its own kicker, headline and evidence in
   * whatever order its idea wants. Only the flag, the logo, the button and
   * the closing line stay put, which is as much as the brand actually needs.
   */
  body?: React.ReactNode;
  cta?: { label: string; bg: string; fg: string };
  /**
   * The doodle tint, when the card wants one.
   *
   * Only the composed cards carry it. The six original grounds are flat and
   * have already been posted; giving them a texture now would change work
   * that is live for no reason other than tidiness.
   */
  doodle?: string;
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

    /* 6 ── seven months of a group chat, as a number ------------------- */
    /* Leads with the arithmetic rather than the thread. "Your group chat
       has been planning this since March" is a sentence you read; "7 months.
       0 plans." is a number you feel, and the thread underneath is then
       evidence rather than the whole joke. */
    {
      ground: "#0E4F57",
      doodle: "rgba(255,255,255,0.075)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.66)",
      on: "dark",
      note: "Just turn up",
      cta: { label: "Somebody else already planned it", bg: "#FFD166", fg: "#0E4F57" },
      body: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="YOUR GROUP CHAT" color="#FFD166" />
          <div style={{ display: "flex", marginTop: 20, fontSize: 132, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1, color: "#fff" }}>
            7 months.
          </div>
          <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1, color: "#FFD166" }}>
            0 plans.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 44 }}>
            <Aged when="March" text="we should do something" />
            <Aged when="August" text="still up for this?" />
            <Aged when="Today" text="so are we still doing this" last />
          </div>
        </div>
      ),
    },

    /* 7 ── fourteen faces, two of them yours --------------------------- */
    /* The evidence goes ABOVE the headline here, so the set does not settle
       into one rhythm. Fourteen discs filling the width say "a room with
       people in it" before a word is read; four list rows did not.
       Two ringed in gold is the entire argument: the fear is not cost or
       distance, it is walking in alone. */
    {
      ground: "#5B3BA8",
      doodle: "rgba(255,255,255,0.08)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.7)",
      on: "dark",
      note: "No walking in cold",
      cta: { label: "See who is going first", bg: "#FFD166", fg: "#3A1F73" },
      body: (
        // Two groups, split top and bottom. A flexGrow spacer between them
        // did not expand here, and the slack stayed under the headline,
        // which is the hole this whole rebuild was about.
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="GOING · 18" color="rgba(255,255,255,0.6)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
            {/* Six across, three down, at 136. The budget here is about 680px
                and it is not negotiable: five at 172 came to 566 for the grid
                alone and the button drew straight over the headline. 136 is
                the largest disc where eighteen of them still fit both the
                960 measure and the height. */}
            {([
              [["T", "#E0657F", 0], ["M", "#3FB6C4", 0], ["K", "#F2A33C", 1], ["B", "#7E8CE0", 0], ["A", "#5FBE8A", 0], ["N", "#E08A5F", 0]],
              [["C", "#F2A33C", 0], ["D", "#7E8CE0", 0], ["F", "#E0657F", 0], ["G", "#5FBE8A", 0], ["H", "#3FB6C4", 1], ["S", "#C77FD1", 0]],
              [["I", "#5FBE8A", 0], ["J", "#E08A5F", 1], ["R", "#3FB6C4", 0], ["P", "#7E8CE0", 0], ["Y", "#C77FD1", 0], ["Z", "#E0657F", 0]],
            ] as [string, string, number][][]).map((row, r) => (
              <div key={r} style={{ display: "flex", gap: 28 }}>
                {row.map(([initial, tone, ring], i) => (
                  <Disc key={`${r}-${i}`} initial={initial} tone={tone} ring={!!ring} />
                ))}
              </div>
            ))}
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 94, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: "#fff" }}>
            You already know
          </div>
          <div style={{ display: "flex", fontSize: 94, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: "#FFD166" }}>
            three of them.
          </div>
         </div>
        </div>
      ),
    },

    /* 8 ── a month with one column filled ------------------------------ */
    /* The platform has run recurring series since August and has never once
       advertised them. A calendar with every Thursday filled says "this
       keeps happening" with no words at all, which is the thumbnail test
       passing outright. It fills the width now; at two thirds it read as a
       chart sitting in a corner. */
    {
      ground: "#B5451F",
      doodle: "rgba(255,255,255,0.075)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.72)",
      on: "dark",
      note: "Same people, weekly",
      cta: { label: "Find one that repeats", bg: "#FFD166", fg: "#7A2C11" },
      body: (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="WHY ONE-OFFS DO NOT WORK" color="rgba(255,255,255,0.6)" />
          <div style={{ display: "flex", marginTop: 20, fontSize: 84, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }}>
            Once is a night out.
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#FFD166" }}>
            Four is a friend group.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 34 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div
                  key={`${d}${i}`}
                  style={{ display: "flex", width: 120, justifyContent: "center", fontSize: 26, fontWeight: 700, color: i === 4 ? "#FFD166" : "rgba(255,255,255,0.42)" }}
                >
                  {d}
                </div>
              ))}
            </div>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} style={{ display: "flex", gap: 16 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                  <Day key={col} on={col === 4} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ),
    },

    /* 9 ── the saved list, where good intentions go -------------------- */
    /* The one light, loud ground in the set. Nine cards of deep colour make
       a grid that reads as a single mood, and this is the post that has to
       stop a thumb.
       The last row breaks the pattern on purpose: three greyed and gone,
       one still live. A card that shows only the failure is a telling-off,
       and nobody follows an account that tells them off. */
    {
      ground: "#F2C230",
      doodle: "rgba(18,18,18,0.07)",
      fg: "#121212",
      fg2: "rgba(18,18,18,0.6)",
      on: "light",
      note: "Actually go",
      cta: { label: "Do that one", bg: "#121212", fg: "#F2C230" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="YOUR SAVED LIST" color="rgba(18,18,18,0.5)" />
          {/* Two children and a gap, not one string with an entity in it.
              The &nbsp; between them was dropped on render and it printed
              "3 gone.1 left." */}
          <div style={{ display: "flex", gap: 24, marginTop: 18, fontSize: 124, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>
            <div style={{ display: "flex", color: "rgba(18,18,18,0.34)" }}>4 gone.</div>
            <div style={{ display: "flex", color: "#121212" }}>1 left.</div>
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column", gap: 13, width: 960 }}>
            <Saved title="Afrobeats night · Wuse 2" when="Been and gone" gone />
            <Saved title="Sunday picnic · Jabi Lake" when="Been and gone" gone />
            <Saved title="Game night · Gwarinpa" when="Been and gone" gone />
            <Saved title="Open mic · Garki" when="Been and gone" gone />
            <Saved title="Book club · Maitama" when="Saturday" />
         </div>
        </div>
      ),
    },

    /* 10 ── the owambe invite, itemised ------------------------------- */
    /* Written as an ad, so it argues with a stranger rather than nodding at
       a member. The only invitations most people actually get are the ones
       that cost a week's wages before you have left the house, and nobody
       has ever put that number on a graphic. Itemising it does the work: by
       the fourth line the reader is adding up their own last owambe. */
    {
      ground: "#4A1A4F",
      doodle: "rgba(255,255,255,0.075)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.68)",
      on: "dark",
      note: "No uniform required",
      cta: { label: "See what is free tonight", bg: "#FFD166", fg: "#3A0F3E" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="THE ONE INVITE YOU GOT THIS YEAR" color="rgba(255,255,255,0.55)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
            <Line label="Aso ebi fabric" value="₦18,000" ink="#fff" faint="rgba(255,255,255,0.62)" />
            <Line label="Tailor" value="₦12,000" ink="#fff" faint="rgba(255,255,255,0.62)" />
            <Line label="Gele" value="₦6,000" ink="#fff" faint="rgba(255,255,255,0.62)" />
            <Line label="Shoes you wore once" value="₦9,000" ink="#fff" faint="rgba(255,255,255,0.62)" />
            <Line label="Total, before you ate anything" value="₦45,000" ink="#FFD166" faint="rgba(255,214,102,0.9)" strong />
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }}>
            Not every invite
          </div>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#FFD166" }}>
            should cost a salary.
          </div>
         </div>
        </div>
      ),
    },

    /* 11 ── the departures board ------------------------------------- */
    /* The most-felt thing in the country right now, and the last row is why
       this is an advertisement and not a lament. Three gone, yours still
       sitting there on time. Warm, not bleak: the answer is not that they
       should have stayed, it is that you can build another one. */
    {
      ground: "#0B0B0B",
      doodle: "rgba(255,255,255,0.06)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.6)",
      on: "dark",
      note: "Still here? Same.",
      cta: { label: "Build the next one", bg: "#FFB020", fg: "#121212" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="DEPARTURES" color="#FFB020" />
          <div style={{ display: "flex", marginTop: 20, fontSize: 82, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }}>
            Your friend group
          </div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#FFB020" }}>
            has an airport problem.
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Departure name="Tobi" to="TORONTO" status="DEPARTED" />
          <Departure name="Ada" to="LONDON" status="DEPARTED" />
          <Departure name="Kemi" to="DUBAI" status="DEPARTED" />
          <Departure name="You" to="WUSE 2" status="ON TIME" home />
         </div>
        </div>
      ),
    },

    /* 12 ── the vacancy nobody posts ---------------------------------- */
    /* Paper, because it is a listing. The joke carries the argument: adult
       friendship really is unpaid work with no advertised openings, and the
       zero applicants line is the bit people send to each other. */
    {
      ground: "#F0EBDF",
      doodle: "rgba(18,18,18,0.06)",
      fg: "#121212",
      fg2: "rgba(18,18,18,0.58)",
      on: "light",
      note: "Applications open",
      cta: { label: "Apply on Saturday", bg: "#121212", fg: "#F0EBDF" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="NOW HIRING" color="#B5451F" />
          <div style={{ display: "flex", marginTop: 18, fontSize: 86, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#121212" }}>
            Making friends at 27
          </div>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#B5451F" }}>
            is a job nobody posts.
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Line label="Role" value="Friend" ink="#121212" faint="rgba(18,18,18,0.6)" />
          <Line label="Experience" value="None" ink="#121212" faint="rgba(18,18,18,0.6)" />
          <Line label="Hours" value="Saturdays" ink="#121212" faint="rgba(18,18,18,0.6)" />
          <Line label="Pay" value="Jollof" ink="#121212" faint="rgba(18,18,18,0.6)" />
          <Line label="Applicants so far" value="0" ink="#B5451F" faint="#B5451F" strong />
         </div>
        </div>
      ),
    },

    /* 13 ── the rent, per night out ----------------------------------- */
    /* The sharpest of the set, because it is arithmetic the reader has
       never done and cannot argue with. You did not rent a flat in Abuja to
       sit in it, and nobody has ever framed the cost of staying in as the
       cost of the city you already paid for. */
    {
      ground: "#0F3A2E",
      doodle: "rgba(255,255,255,0.07)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.64)",
      on: "dark",
      note: "You already paid for the city",
      cta: { label: "Get your money's worth", bg: "#7BE3A8", fg: "#06281E" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="YOUR RENT, PER NIGHT OUT" color="rgba(255,255,255,0.55)" />
          <div style={{ display: "flex", marginTop: 16, fontSize: 158, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1, color: "#7BE3A8" }}>
            ₦800,000
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 36, fontWeight: 400, color: "rgba(255,255,255,0.66)" }}>
            That is what each one cost you this year.
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Line label="Rent, twelve months" value="₦2.4m" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Times you actually went out" value="3" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Cost per night out" value="₦800,000" ink="#7BE3A8" faint="rgba(123,227,168,0.9)" strong />
         </div>
        </div>
      ),
    },

    /* 14 ── the lobby ------------------------------------------------ */
    /* The trend worth riding is the VOCABULARY, not somebody else's
       dashboard. The first cut of this card quoted a live player counter
       off another company's stats page, which borrows their credibility,
       makes our advertisement about their product, and is wrong within the
       hour anyway. Everything here is ours.
       "Lagos is multiplayer" is the whole pitch in three words, in the
       grammar a few million people happen to be speaking this week, and it
       names nobody. */
    {
      ground: "#D6246E",
      doodle: "rgba(255,255,255,0.09)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.72)",
      on: "dark",
      note: "Co-op enabled",
      cta: { label: "Join a full party", bg: "#121212", fg: "#FFD166" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="YOUR SATURDAY, CURRENTLY" color="rgba(255,255,255,0.72)" />
          <div style={{ display: "flex", marginTop: 20, fontSize: 96, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#fff" }}>
            Lagos is multiplayer.
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#FFD166" }}>
            You are playing solo.
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.7)", marginBottom: 22 }}>
            YOUR PARTY · 1 / 6
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Disc initial="You" tone="#FFD166" ink="#8E1246" />
            <Slot />
            <Slot />
            <Slot />
            <Slot />
            <Slot />
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 32, fontWeight: 400, color: "rgba(255,255,255,0.72)" }}>
            Waiting for five more players.
          </div>
         </div>
        </div>
      ),
    },

    /* 15 ── the side quest -------------------------------------------- */
    /* Game grammar pointed at a Saturday. "NPC in your own city" is the
       line people repeat, and a quest card is a shape everybody can read
       without being told what it is. Nobody is named and nothing is quoted. */
    {
      ground: "#241E6B",
      doodle: "rgba(255,255,255,0.08)",
      fg: "#FFFFFF",
      fg2: "rgba(255,255,255,0.68)",
      on: "dark",
      note: "Difficulty: easy",
      cta: { label: "Accept the quest", bg: "#7BE3A8", fg: "#10194A" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="SIDE QUEST AVAILABLE" color="#7BE3A8" />
          <div style={{ display: "flex", marginTop: 20, fontSize: 94, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#fff" }}>
            Stop being an NPC
          </div>
          <div style={{ display: "flex", fontSize: 94, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#7BE3A8" }}>
            in your own city.
          </div>
         </div>
         <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Line label="Objective" value="Leave the house" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Time required" value="One evening" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Entry cost" value="₦0" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Reward" value="Three new people" ink="#fff" faint="rgba(255,255,255,0.62)" />
          <Line label="Status" value="NOT STARTED" ink="#7BE3A8" faint="rgba(123,227,168,0.9)" strong />
         </div>
        </div>
      ),
    },

    /* 16 ── everyone online, nobody outside -------------------------- */
    /* The one light ground in the back half of the set, because in a grid
       of dark cards the pale one is what stops a thumb.
       This used to lead on a borrowed player count. It does not need one:
       "everyone is online" is a thing the reader already knows about their
       own evening, and an observation we can make is worth more than a
       statistic we have to attribute. */
    {
      ground: "#FAFAF7",
      doodle: "rgba(18,18,18,0.07)",
      fg: "#121212",
      fg2: "rgba(18,18,18,0.56)",
      on: "light",
      note: "No loading screen",
      cta: { label: "See what is on tonight", bg: "#D6246E", fg: "#FFFFFF" },
      body: (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
         <div style={{ display: "flex", flexDirection: "column" }}>
          <Kicker text="TONIGHT, EVERYWHERE IN LAGOS" color="#D6246E" />
          <div style={{ display: "flex", marginTop: 18, fontSize: 104, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#121212" }}>
            Everybody is online.
          </div>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#D6246E" }}>
            Be the one outside.
          </div>
         </div>
         {/* Three lit squares in a field of flat ones. The card is an
             instruction to be one of the three, so three of them exist. */}
         <Dots color="rgba(18,18,18,0.13)" lit="#D6246E" />
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
        {/* Behind everything, including the flag's own white stripe, so the
            card has a surface rather than a fill. One <img>, because Satori
            lays out every node it is given and a few hundred positioned
            divs is both slow and a good way to blow the layout up. */}
        {s.doodle ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/svg+xml,${encodeURIComponent(doodleField(SIZE, SIZE, s.doodle, 15))}`}
            alt=""
            width={SIZE}
            height={SIZE}
            style={{ position: "absolute", top: 0, left: 0, width: SIZE, height: SIZE }}
          />
        ) : null}

        <Flag />

        <Wordmark on={s.on} />

        {/* The art takes the room that is left and sits in the middle of it.
            Pinned to the top it left a hole between the picture and the
            sentence, which read as a layout that had lost something. */}
        {s.body ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: 34, paddingBottom: 30 }}>
            {s.body}
          </div>
        ) : (
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
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: s.body ? 26 : 30 }}>
          {s.body ? null : s.copy}
          {s.cta ? <Cta label={s.cta.label} bg={s.cta.bg} fg={s.cta.fg} /> : null}
          <Foot fg={s.fg} fg2={s.fg2} note={s.note} />
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );
}
