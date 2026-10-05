import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import { SITE_ORIGIN } from "@/lib/qr";
import { pngToPdf } from "@/lib/print-pdf";

/**
 * The team's neck tag for the AITF LinkUp Jollof Party.
 *
 * WHAT THIS IS FOR. On the night, a guest with a question has to find
 * somebody who works here, in a hall of several hundred people, most of whom
 * also look like they might. A tag solves that only if it answers two things
 * from across a room: is this person staff, and what do they do. So TEAM is
 * set as large as the card allows and the team sits in a full-bleed colour
 * band under it, colour-coded, because a colour reads at a distance where
 * type has already failed.
 *
 * THE NAME SITS ON CREAM, ALWAYS. Two reasons, both of them physical. A name
 * printed on the maroon is lovely and a name WRITTEN on the maroon is
 * invisible, and half of these will be filled in with a biro at the door
 * when somebody turns up who was not on the list. The cream panel is the same
 * panel whether the name is printed or written, so a hand-filled tag is not
 * obviously the cheap one.
 *
 * THE TOP 15MM CARRY NOTHING. That is where the punch goes and where the
 * pouch lip sits. Anything composed into that strip is either hole-punched or
 * hidden, and you find out after the print run.
 *
 * ?v=
 *   front       the tag (default)
 *   back        the reverse: the rules, who to call, the QR
 *   sheet       four fronts on A4 with crop marks, ready to cut
 *   sheet-back  four backs, for the reverse of that sheet
 *
 * ?name=            printed on the front. Leave it out and you get a rule
 *                    to write on at the door.
 * ?team=            linkupnaija (the default) or aitf. The band colour and
 *                    the word on it both follow.
 * ?names=            the sheet, up to four: `Tobi Ade|aitf,Ada N|linkupnaija`.
 *                    Leave it out for four blank tags to fill in by hand,
 *                    which is the usual case; ?team= then sets all four.
 * ?phone=            overrides the coordinator's number on the back.
 * ?size=badge|a6     86×125mm (the usual lanyard pouch) or A6. Portrait both.
 * ?dpi=              300 by default, which is what a press wants. Drop it to
 *                    96 for a quick look on screen.
 * ?bleed=1           adds 3mm of bleed all round. Ask your printer whether
 *                    they want it before you send a bled file.
 * ?guides=1          draws the trim and the lanyard safe zone. Never send a
 *                    file with guides on it to print.
 * ?format=pdf        a PDF at the real physical size, which is what a print
 *                    shop wants. A PNG does not state how big it is, so a
 *                    300dpi file is only 300dpi if whoever opens it agrees;
 *                    the PDF carries 86×125mm in the page itself. Works on
 *                    every variant. PNG otherwise.
 *
 * THE DATES COME FROM THE DATABASE, for the reason ig-card/jollof gives at
 * length: a graphic that hardcodes a date goes on contradicting the event
 * page the moment somebody moves a night. It matters more here than there.
 * A post with the wrong date can be deleted; two hundred printed tags cannot.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * The A4 sheet takes about fourteen seconds, which is over the default
 * serverless limit and would come back as a 504 rather than a sheet.
 *
 * It is not the PDF step — that is free. It is Satori laying out four tags
 * at A4 scale and decoding the embedded partner logo once for each of them.
 * Nobody is waiting on this but a print job, so the fix is to let it finish
 * rather than to make the sheet cheaper and worse.
 */
export const maxDuration = 60;

/* ------------------------------------------------------------ palette ---- */
/** The flyer's, so the tag and the posts read as one party. */
const MAROON = "#3D0A0E";
const MAROON_2 = "#5A1116";
const GOLD = "#F0B849";
const CREAM = "#FFF3E0";
const RED = "#C1272D";
const GREEN = "#008753";

/**
 * The two teams on the night, and the band colour each one gets.
 *
 * It used to be six job roles — Host, Security, Kitchen, Media and so on —
 * which was an invented structure. There are two teams running this: ours
 * and the fair's. A band that claims a hierarchy nobody is organised into
 * just means half the tags get the wrong one at the door.
 *
 * Each team wears its OWN brand colour, which is the whole point: the band
 * is findable before the word is readable, and violet already means us and
 * green already means AITF on everything else either of us prints. `ink` is
 * set per colour rather than computed, because a contrast function that gets
 * one of these wrong puts unreadable type on a printed card.
 */
const TEAMS: Record<string, { band: string; ink: string; label: string }> = {
  linkupnaija: { band: "#534AB7", ink: "#FFFFFF", label: "LinkUpNaija" },
  lun: { band: "#534AB7", ink: "#FFFFFF", label: "LinkUpNaija" },
  aitf: { band: GREEN, ink: "#FFFFFF", label: "AITF" },
};
const TEAM_DEFAULT = TEAMS.linkupnaija;

const teamColour = (team: string) => TEAMS[team.trim().toLowerCase()] ?? TEAM_DEFAULT;

/**
 * The key, printed on the back.
 *
 * One entry per TEAM, not per spelling, which is why `lun` is absent: it is
 * an alias so whoever types the URL does not have to spell the whole thing,
 * and listing it would show two colours under three labels.
 */
const KEY = [TEAMS.linkupnaija, TEAMS.aitf];

/* -------------------------------------------------------------- sizes ---- */
/**
 * Trim sizes in millimetres. Both portrait and close enough in proportion
 * (0.69 and 0.71) that one layout serves both — the spare height is absorbed
 * by a single flexible gap rather than by a second set of numbers to keep in
 * step with the first.
 */
const SIZES: Record<string, { w: number; h: number }> = {
  badge: { w: 86, h: 125 }, // what a standard lanyard pouch takes
  a6: { w: 105, h: 148 },
};

const BLEED_MM = 3;
/** The punch and the pouch lip own the top of the card. */
const SAFE_TOP_MM = 15;

/**
 * A partner's logo, inlined.
 *
 * Fetched and turned into a data URI rather than handed to Satori as a URL,
 * so one slow or sulking storage bucket cannot take the whole card down with
 * it: a failure here returns null and the card falls back to setting the
 * partner's initials as type. A tag that prints without a logo is a
 * disappointment; a tag route that 500s the afternoon of the print run is a
 * problem.
 *
 * THE CONTENT TYPE IS CHECKED, AND WEBP IS REFUSED ON PURPOSE. Satori does
 * not decode WebP and does not say so — it draws nothing and returns 200.
 * Three photographs went out as blank white rectangles on the banner before
 * anybody noticed, because a blank area looks like a design decision. If the
 * bucket ever starts serving WebP, this returns null and you get the
 * initials, which is wrong in a way you can see.
 */
export interface InlineLogo {
  src: string;
  /** height ÷ width, so the card can size by width and keep the proportions. */
  ratio: number;
}

/**
 * Intrinsic dimensions, read from the file's own header.
 *
 * Satori needs both width and height on an <img>; it will not work one out
 * from the other. Guessing a ratio would stretch somebody else's logo, which
 * is the one thing you must not do to a partner's mark, so a file whose
 * header cannot be read is treated as no logo at all.
 */
function imageRatio(buf: Buffer, type: string): number | null {
  try {
    if (type === "image/png" && buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return buf.readUInt32BE(20) / buf.readUInt32BE(16);
    }
    if (type === "image/gif" && buf.length > 10) {
      return buf.readUInt16LE(8) / buf.readUInt16LE(6);
    }
    if (type === "image/jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const m = buf[i + 1];
        // SOF0-3 and SOF5-15 carry the frame size; DHT/DAC/RST do not.
        if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xcf && m !== 0xc8 && m !== 0xcc)) {
          return buf.readUInt16BE(i + 5) / buf.readUInt16BE(i + 7);
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Logos that have been fetched successfully, kept for the life of the
 * process.
 *
 * Not an optimisation. The first budget here was six seconds and the bucket
 * took longer than that to hand over 174KB, so the card rendered with the
 * partner's logo silently replaced by its initials — and a minute later the
 * same fetch took 582ms. A print run is a dozen requests over ten minutes,
 * and a flake in the middle of one would produce a stack of tags where some
 * carry the logo and some do not. Once it has been read, it stays read.
 */
const logoCache = new Map<string, InlineLogo>();

async function inlineImage(raw: string | null): Promise<InlineLogo | null> {
  if (!raw || !/^https:\/\/\S+$/i.test(raw.trim())) return null;
  const key = raw.trim();
  const hit = logoCache.get(key);
  if (hit) return hit;
  try {
    const r = await fetch(key, {
      cache: "no-store",
      // Generous on purpose: nothing is waiting on this but a print job.
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!["image/png", "image/jpeg", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    // A file this big is a sign somebody uploaded the print artwork. It would
    // still render, slowly, four times over on a sheet; better to fall back.
    if (buf.byteLength > 2_000_000) return null;
    const ratio = imageRatio(buf, type);
    if (!ratio || !isFinite(ratio) || ratio <= 0) return null;
    const logo = { src: `data:${type};base64,${buf.toString("base64")}`, ratio };
    logoCache.set(key, logo);
    return logo;
  } catch {
    return null;
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


/**
 * The number on the back.
 *
 * Hardcoded, unlike the dates and the venue, because there is nowhere in the
 * schema to read it from: events carry no contact column, and adding one by
 * migration for a single number on a single night's tag is more machinery
 * than the problem deserves. `?phone=` overrides it, and this line is the
 * one place to change it. If a second event ever wants its own number, that
 * is the moment to put it in the database rather than add a second constant.
 */
const COORDINATOR = "08160065025";

/**
 * Grouped so it can be dialled by somebody in a hurry in a loud room.
 *
 * Nigerian mobiles are eleven digits and read as 4-3-4. Only a string that
 * is exactly eleven digits is touched; anything else, including a number
 * somebody passes with a +234 or their own spacing, is printed as given
 * rather than regrouped into something they did not intend.
 */
function prettyPhone(v: string) {
  return /^\d{11}$/.test(v) ? `${v.slice(0, 4)} ${v.slice(4, 7)} ${v.slice(7)}` : v;
}

/** What a tag is actually for, said once, on the back. */
const RULES = [
  "Wear it where it can be seen, all night.",
  "It is not transferable. Do not lend it to a guest.",
  "Lost it? Registration desk, before you go back in.",
  "Hand it back at the end of the night.",
];

/* ============================================================== render ==== */

interface TagProps {
  /** Pixels per millimetre, so every number below is a real measurement. */
  px: (mm: number) => number;
  /** Proportional unit: n out of a 1016px-wide card. Keeps type on scale. */
  u: (n: number) => number;
  w: number;
  h: number;
  bleed: number;
  guides: boolean;
  dates: string;
  name: string;
  team: string;
  /** The event's own location string, straight from the row. */
  venue: string;
  /** The partner's mark, or null when it could not be read. */
  aitf: InlineLogo | null;
}

/** The flag, as it appears on everything else we print. */
function Flag({ w, t, bottom }: { w: number; t: number; bottom?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        [bottom ? "bottom" : "top"]: 0,
        left: 0,
        display: "flex",
        width: w,
      }}
    >
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: GREEN }} />
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: "#FFFFFF" }} />
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: GREEN }} />
    </div>
  );
}

/**
 * The front.
 *
 * Built as a component rather than inline because the print sheet draws four
 * of it. A sheet laid out by copying the markup four times is a sheet where
 * three of them are a version behind within a week.
 */
function Front(p: TagProps) {
  const { u, px, w, h, bleed, guides, dates, name, team, aitf, venue } = p;
  const colour = teamColour(team);
  const inner = u(70);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: w + bleed * 2,
        height: h + bleed * 2,
        backgroundColor: MAROON,
        backgroundImage: `linear-gradient(165deg, ${MAROON_2} 0%, ${MAROON} 60%)`,
        overflow: "hidden",
      }}
    >
      <Flag w={w + bleed * 2} t={u(16)} />

      {/* The top is deliberately empty: punch and pouch lip. */}
      <div style={{ display: "flex", height: px(SAFE_TOP_MM) + bleed }} />

      {/* ------------------------------------------------------- who --- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: inner + bleed,
          paddingRight: inner + bleed,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: u(14) }}>
          {/* Sized against the AITF plate opposite, not against the margin.
              Our mark at 54 looked like a credit next to a partner logo at
              300, which is the wrong way round on our own tag. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_MARK_DATA_URI}
            alt=""
            width={u(72)}
            height={u(72)}
            style={{ width: u(72), height: u(72) }}
          />
          <div
            style={{
              display: "flex",
              fontSize: u(46),
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
            }}
          >
            Link<span style={{ color: "#8B83E6" }}>Up</span>Naija
          </div>
        </div>
        {/* ------------------------------------------- the partner ---- */}
        {/* ON A PLATE, BECAUSE THE AITF MARK IS DARK GREEN. Laid straight
            onto the maroon it goes muddy and the hairlines in INTERNATIONAL
            TRADE FAIR close up entirely at 15mm wide — you would get a green
            smudge where a partner's logo should be, and only find out from
            the printed proof. The plate is the cream already on the card,
            not white, so the tag has two light tones and not three.

            Sized by WIDTH with the height derived from the real aspect
            ratio, so a partner whose logo is square or tall gets their own
            proportions rather than this one's squashed into them. */}
        {aitf ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: CREAM,
              borderRadius: u(10),
              padding: u(11),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aitf.src}
              alt=""
              width={u(300)}
              height={Math.round(u(300) * aitf.ratio)}
              style={{ width: u(300), height: Math.round(u(300) * aitf.ratio) }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: u(26), fontWeight: 700, color: GOLD, letterSpacing: "0.1em" }}>
            AITF
          </div>
        )}
      </div>

      {/* ----------------------------------------------- which party --- */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          paddingLeft: inner + bleed,
          paddingRight: inner + bleed,
          marginTop: u(52),
        }}
      >
        <div style={{ display: "flex", fontSize: u(34), fontWeight: 700, color: "rgba(255,243,224,0.6)", letterSpacing: "0.16em" }}>
          JOLLOF PARTY
        </div>
        {/* The biggest thing on the card, because "is this person staff" is
            the question a guest is answering from ten feet away.
            300 is as large as it goes: TEAM sets to about 2.76em in Noto
            Sans Bold, so 300 fills 828 of the 876 between the margins and
            320 runs off the edge. Satori does not clip, it just draws past
            the card, and you would not see it until the proof came back. */}
        <div
          style={{
            display: "flex",
            fontSize: u(300),
            fontWeight: 700,
            color: CREAM,
            lineHeight: 1,
            marginTop: u(12),
          }}
        >
          TEAM
        </div>
      </div>

      {/* Half the slack. The other half sits under the name panel, so a card
          with height to spare looks evenly aired rather than bottom-heavy. */}
      <div style={{ display: "flex", flexGrow: 1 }} />

      {/* ------------------------------------------------- the team ---- */}
      {/* Full bleed on purpose. A band that stops short of the edge is a
          stripe; one that runs off both sides is the card's identity, and it
          survives being half-covered by a jacket. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: w + bleed * 2,
          height: u(104),
          backgroundColor: colour.band,
          marginTop: u(34),
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: u(50),
            fontWeight: 700,
            color: colour.ink,
            letterSpacing: "0.14em",
          }}
        >
          {colour.label}
        </div>
      </div>

      {/* -------------------------------------------------- the name ---- */}
      {/* The panel GROWS to fill whatever height is left rather than sitting
          at a fixed 200 with a hole under it, which is what the first cut
          did on both sizes. Two gains for one change: the card no longer has
          a dead maroon band across its lower third, and the writing area on
          a blank tag is big enough for a biro and a long name. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: u(250),
          marginLeft: inner + bleed,
          marginRight: inner + bleed,
          marginTop: u(36),
          backgroundColor: CREAM,
          borderRadius: u(16),
          paddingLeft: u(24),
          paddingRight: u(24),
        }}
      >
        {name ? (
          <div
            style={{
              display: "flex",
              fontSize: name.length > 14 ? u(56) : u(74),
              fontWeight: 700,
              color: MAROON,
              letterSpacing: "-0.02em",
              textAlign: "center",
            }}
          >
            {name}
          </div>
        ) : (
          // A rule to write on. Label above, line below, the way every form
          // anybody has filled in is laid out — and it puts the line in the
          // lower half of the panel, where a hand writing on a card held
          // against a table actually wants it.
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", fontSize: u(24), fontWeight: 700, color: "rgba(61,10,14,0.5)", letterSpacing: "0.14em" }}>
              NAME
            </div>
            <div style={{ display: "flex", width: "100%", height: u(4), backgroundColor: "rgba(61,10,14,0.35)", marginTop: u(90) }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexGrow: 1 }} />

      {/* ------------------------------------------------- the night ---- */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingLeft: inner + bleed,
          paddingRight: inner + bleed,
          paddingBottom: px(SAFE_TOP_MM * 0.5) + bleed,
        }}
      >
        <div style={{ display: "flex", fontSize: u(32), fontWeight: 700, color: GOLD, letterSpacing: "0.06em" }}>
          {dates}
        </div>
        {/* The place, without the street. The back carries the full address;
            repeating it here would set six-point type on a card that is
            already being worn AT the address. */}
        <div
          style={{
            display: "flex",
            fontSize: u(23),
            fontWeight: 400,
            color: "rgba(255,243,224,0.55)",
            marginTop: u(8),
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {venue.split(",")[0]}
        </div>
      </div>

      <Flag w={w + bleed * 2} t={u(16)} bottom />

      {guides ? <Guides w={w} h={h} bleed={bleed} px={px} /> : null}
    </div>
  );
}

/** The reverse. */
function Back(p: TagProps) {
  const { u, px, w, h, bleed, guides, dates, name, aitf, venue } = p;
  const qrSrc = (p as TagProps & { qrSrc: string }).qrSrc;
  const phone = (p as TagProps & { phone: string }).phone;
  const inner = u(70);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: w + bleed * 2,
        height: h + bleed * 2,
        backgroundColor: CREAM,
        overflow: "hidden",
      }}
    >
      <Flag w={w + bleed * 2} t={u(16)} />
      <div style={{ display: "flex", height: px(SAFE_TOP_MM) + bleed }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          paddingLeft: inner + bleed,
          paddingRight: inner + bleed,
          flexGrow: 1,
        }}
      >
        {/* No plate on this side. The back is already cream, which is the
            ground the AITF mark was drawn for, so putting it in a box here
            would be a box around nothing. */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: u(30), fontWeight: 700, color: RED, letterSpacing: "0.14em" }}>
              TEAM PASS
            </div>
            <div style={{ display: "flex", fontSize: u(40), fontWeight: 700, color: MAROON, marginTop: u(10), letterSpacing: "-0.01em" }}>
              AITF LinkUp Jollof Party
            </div>
            <div style={{ display: "flex", fontSize: u(26), fontWeight: 700, color: "rgba(61,10,14,0.55)", marginTop: u(6) }}>
              {dates}
            </div>
          </div>
          {aitf ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aitf.src}
              alt=""
              width={u(240)}
              height={Math.round(u(240) * aitf.ratio)}
              style={{ width: u(240), height: Math.round(u(240) * aitf.ratio) }}
            />
          ) : null}
        </div>

        <div style={{ display: "flex", width: "100%", height: u(3), backgroundColor: "rgba(61,10,14,0.15)", marginTop: u(28) }} />

        <div style={{ display: "flex", flexDirection: "column", marginTop: u(26), gap: u(18) }}>
          {RULES.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  display: "flex",
                  width: u(12),
                  height: u(12),
                  borderRadius: u(6),
                  backgroundColor: RED,
                  marginTop: u(11),
                  marginRight: u(16),
                }}
              />
              <div style={{ display: "flex", fontSize: u(28), fontWeight: 400, color: MAROON, lineHeight: 1.3 }}>
                {r}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* ------------------------------------------------ who's who ---- */}
        {/* The key to the band colours on the front, drawn as the bands
            themselves rather than as swatches beside a list. With six roles
            a swatch list was the only thing that fitted; with two teams it
            left a thin line of colour chips stranded in the middle of the
            card, and the reader has to translate a swatch into the band they
            are looking at anyway. These ARE the band. */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: u(30) }}>
          <div style={{ display: "flex", fontSize: u(22), fontWeight: 700, color: "rgba(61,10,14,0.55)", letterSpacing: "0.14em" }}>
            THE TWO TEAMS TONIGHT
          </div>
          <div style={{ display: "flex", marginTop: u(18) }}>
            {KEY.map((k, i) => (
              <div
                key={k.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexGrow: 1,
                  flexBasis: 0,
                  height: u(78),
                  borderRadius: u(10),
                  backgroundColor: k.band,
                  marginLeft: i === 0 ? 0 : u(16),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: u(30),
                    fontWeight: 700,
                    color: k.ink,
                    letterSpacing: "0.06em",
                  }}
                >
                  {k.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* Who to call. The one thing on a tag that gets used in a hurry, so
            it is set at the size of the thing above it, not as fine print. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: MAROON,
            borderRadius: u(16),
            padding: u(24),
            marginBottom: u(24),
          }}
        >
          <div style={{ display: "flex", fontSize: u(22), fontWeight: 700, color: GOLD, letterSpacing: "0.12em" }}>
            ANY TROUBLE, CALL
          </div>
          {phone ? (
            <div style={{ display: "flex", fontSize: u(46), fontWeight: 700, color: CREAM, marginTop: u(8) }}>
              {phone}
            </div>
          ) : (
            <div style={{ display: "flex", width: "100%", height: u(3), backgroundColor: "rgba(255,243,224,0.45)", marginTop: u(34) }} />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", paddingBottom: px(SAFE_TOP_MM * 0.5) + bleed }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="" width={u(118)} height={u(118)} style={{ width: u(118), height: u(118) }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: u(20), flexGrow: 1 }}>
            <div style={{ display: "flex", fontSize: u(28), fontWeight: 700, color: MAROON }}>
              linkupnaija.com
            </div>
            <div style={{ display: "flex", fontSize: u(20), fontWeight: 400, color: "rgba(61,10,14,0.6)", marginTop: u(6), lineHeight: 1.25 }}>
              {venue}
            </div>
          </div>
        </div>
      </div>

      <Flag w={w + bleed * 2} t={u(16)} bottom />
      {guides ? <Guides w={w} h={h} bleed={bleed} px={px} dark /> : null}
      {/* name is unused on the back; referenced so the prop shape stays one
          type for both faces. */}
      <div style={{ display: "none" }}>{name}</div>
    </div>
  );
}

/**
 * Trim line and lanyard safe zone, for checking the artwork.
 *
 * On screen only. A guide that reaches the printer is a guide that gets
 * printed, which is why this is off unless you ask for it by name.
 */
function Guides({
  w,
  h,
  bleed,
  px,
  dark,
}: {
  w: number;
  h: number;
  bleed: number;
  px: (mm: number) => number;
  dark?: boolean;
}) {
  const c = dark ? "rgba(193,39,45,0.75)" : "rgba(240,184,73,0.8)";
  return (
    <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: w + bleed * 2, height: h + bleed * 2 }}>
      {bleed > 0 ? (
        <div
          style={{
            position: "absolute",
            top: bleed,
            left: bleed,
            width: w,
            height: h,
            border: `2px dashed ${c}`,
            display: "flex",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: bleed + px(SAFE_TOP_MM),
          left: bleed,
          width: w,
          height: 2,
          backgroundColor: c,
          display: "flex",
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- GET ---- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const variant = (url.searchParams.get("v") ?? "front").toLowerCase();

  const size = SIZES[(url.searchParams.get("size") ?? "badge").toLowerCase()] ?? SIZES.badge;
  const dpi = Math.min(600, Math.max(72, Number(url.searchParams.get("dpi")) || 300));
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);

  const w = px(size.w);
  const h = px(size.h);
  /** Type scales with the card, not with the pixel count. */
  const u = (n: number) => Math.max(1, Math.round((n / 1016) * w));

  const bleed = url.searchParams.get("bleed") === "1" ? px(BLEED_MM) : 0;
  const guides = url.searchParams.get("guides") === "1";
  const wantsPdf = (url.searchParams.get("format") ?? "").toLowerCase() === "pdf";

  /**
   * The dates, read rather than typed.
   *
   * Same supabase client shape as ig-card/jollof, and for the same reason:
   * Next patches fetch inside a route handler, this route's URL for a blank
   * tag never varies, and without no-store the first answer it ever gets is
   * the one it keeps giving. That route spent a day insisting the party was
   * not happening. Two hundred printed tags would be a more expensive way to
   * learn it.
   */
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (u2, init) => fetch(u2, { ...init, cache: "no-store" }) } }
  );

  // logo_url rides along with the id rather than getting its own round trip,
  // and the partner row is where it lives so a new AITF logo is an upload in
  // the admin panel, not a deploy.
  const { data: partner } = await supabase
    .from("partners")
    .select("id, logo_url")
    .eq("slug", "aitf")
    .maybeSingle();

  const { data: nights } = partner
    ? await supabase
        .from("events")
        .select("date, location")
        .eq("partner_id", (partner as { id: string }).id)
        .ilike("title", "%Jollof%")
        .order("date")
    : { data: null };

  const rows = (nights ?? []) as { date: string; location: string | null }[];
  if (rows.length === 0) {
    return new Response(
      "No Jollof Party events found. Run migration-aitf-jollof-party.sql first.",
      { status: 404 }
    );
  }

  // Plain number parsing, not Date(), which would apply the server's timezone
  // and can walk a date across midnight.
  const parts = rows.map((r) => r.date.split("-").map(Number));
  const year = parts[0][0];
  const sameMonth = parts.every((p) => p[1] === parts[0][1]);
  const dates = sameMonth
    ? `${parts.map((p) => p[2]).join(" & ")} ${MONTHS[parts[0][1] - 1]} ${year}`
    : parts.map((p) => `${p[2]} ${MONTHS[p[1] - 1]}`).join(" & ") + ` ${year}`;
  /**
   * The venue, read rather than typed, for the same reason as the dates.
   *
   * The hardcoded string here said "Abuja Chamber of Commerce Trade Fair
   * Complex" and the row says "Abuja Chamber of Commerce and Industry Trade
   * Fair Complex". Nobody would have caught that until a printed tag was
   * sitting next to the event page. The sibling Jollof post card had the
   * same two words missing, and it was already FETCHING location and then
   * rendering a constant instead.
   */
  const venue = rows.find((r) => r.location)?.location?.trim() ?? "";

  // DAYS is kept in step with the other cards even though the tag has no room
  // for a weekday; referenced here so it cannot drift unnoticed.
  void DAYS;

  const aitf = await inlineImage(
    (partner as { logo_url?: string | null } | null)?.logo_url ?? null
  );

  const qrSvg = await QRCode.toString(SITE_ORIGIN, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: MAROON, light: CREAM },
  });
  const qrSrc = `data:image/svg+xml,${encodeURIComponent(qrSvg)}`;

  const fonts = await ogFonts();

  const base = {
    px,
    u,
    w,
    h,
    bleed,
    guides,
    dates,
    qrSrc,
    aitf,
    venue,
    phone: prettyPhone((url.searchParams.get("phone") || COORDINATOR).trim()),
  };

  /* ------------------------------------------------------ one tag ---- */
  if (variant === "front" || variant === "back") {
    const props = {
      ...base,
      name: (url.searchParams.get("name") ?? "").trim(),
      team: (url.searchParams.get("team") ?? "").trim(),
    } as TagProps;

    const node = variant === "back" ? Back(props) : Front(props);
    const img = new ImageResponse(node, {
      width: w + bleed * 2,
      height: h + bleed * 2,
      fonts,
    });
    return wantsPdf
      ? await asPdf(
          img,
          size.w + (bleed ? BLEED_MM * 2 : 0),
          size.h + (bleed ? BLEED_MM * 2 : 0),
          `LinkUpNaija team tag ${variant}`,
          `linkupnaija-team-tag-${variant}`
        )
      : withHeaders(img);
  }

  /* -------------------------------------------------- the A4 sheet ---- */
  /**
   * Four up on A4, with crop marks.
   *
   * Without this the tag is a nice picture that nobody can produce. Four of
   * the badge size is 172×250mm, which clears A4's 210×297 with margin for
   * the marks, and four is also about as many as anyone cuts accurately in
   * one go with a guillotine.
   *
   * The backs are identical for everybody, so the reverse sheet needs no
   * matching order and duplex alignment stops mattering. That is the whole
   * reason the name is on the front and nothing personal is on the back.
   */
  const A4W = px(210);
  const A4H = px(297);
  const COLS = 2;
  const ROWS = 2;
  const gridW = w * COLS;
  const gridH = h * ROWS;
  const offX = Math.round((A4W - gridW) / 2);
  const offY = Math.round((A4H - gridH) / 2);

  if (offX < px(5) || offY < px(5)) {
    return new Response(
      `A sheet of ${size.w}×${size.h}mm tags does not fit four-up on A4. Use ?size=badge.`,
      { status: 400 }
    );
  }

  /**
   * The team for any tag the `names` list does not name.
   *
   * Which is usually all four: the names go on with a biro at the door, so
   * the common case is a stack of blank tags for one team and the list is
   * not supplied at all. Without this, asking for a blank AITF sheet meant
   * writing `names=|aitf,|aitf,|aitf,|aitf`, which is a syntax nobody should
   * have to work out from a URL.
   */
  const sheetTeam = (url.searchParams.get("team") ?? "").trim();

  const people = (url.searchParams.get("names") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, COLS * ROWS)
    .map((s) => {
      const [n, r] = s.split("|");
      return { name: (n ?? "").trim(), team: (r ?? "").trim() || sheetTeam };
    });
  while (people.length < COLS * ROWS) people.push({ name: "", team: sheetTeam });

  const backs = variant === "sheet-back";
  const mark = px(4);

  const sheet = new ImageResponse(
    (
        <div
          style={{
            position: "relative",
            display: "flex",
            width: A4W,
            height: A4H,
            backgroundColor: "#FFFFFF",
          }}
        >
          {people.map((p, i) => {
            const cx = i % COLS;
            const cy = Math.floor(i / COLS);
            const left = offX + cx * w;
            const top = offY + cy * h;
            const props = { ...base, name: p.name, team: p.team, bleed: 0 } as TagProps;
            return (
              <div key={i} style={{ position: "absolute", left, top, display: "flex" }}>
                {backs ? Back(props) : Front(props)}
              </div>
            );
          })}

          {/* Crop marks, in the margin, never across the artwork. */}
          {[0, 1, 2].map((cx) =>
            [0, 1, 2].map((cy) => {
              const x = offX + cx * w;
              const y = offY + cy * h;
              return (
                <div key={`${cx}-${cy}`} style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: x - mark - px(1),
                      top: y,
                      width: mark,
                      height: 1,
                      backgroundColor: "#000",
                      display: "flex",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: x + px(1),
                      top: y,
                      width: mark,
                      height: 1,
                      backgroundColor: "#000",
                      display: "flex",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: y - mark - px(1),
                      width: 1,
                      height: mark,
                      backgroundColor: "#000",
                      display: "flex",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: y + px(1),
                      width: 1,
                      height: mark,
                      backgroundColor: "#000",
                      display: "flex",
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      ),
    { width: A4W, height: A4H, fonts }
  );

  return wantsPdf
    ? await asPdf(sheet, 210, 297, `LinkUpNaija team tags, A4 ${backs ? "backs" : "fronts"}`,
        `linkupnaija-team-tags-a4-${backs ? "backs" : "fronts"}`)
    : withHeaders(sheet);
}

/**
 * Hand the rendered page to the printer as a PDF at its true size.
 *
 * The ImageResponse is consumed here rather than streamed, because the PNG
 * has to be decoded whole before any of it can be re-encoded — there is no
 * partial answer to give.
 */
async function asPdf(
  img: ImageResponse,
  mmW: number,
  mmH: number,
  title: string,
  filename: string
) {
  const png = Buffer.from(await img.arrayBuffer());
  const pdf = pngToPdf(png, mmW, mmH, title);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline, so clicking the link previews it rather than dropping a file
      // in Downloads that you then have to go and find.
      "Content-Disposition": `inline; filename="${filename}.pdf"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

/**
 * next/og hardcodes a year of immutable caching, which would pin a tag made
 * before a date change into every browser that saw it.
 */
function withHeaders(res: ImageResponse) {
  res.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
