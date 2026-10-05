import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The Jollof Party post, at 1080×1350.
 *
 * WHY THIS EXISTS RATHER THAN A CROP. The flyer is roughly 9:16, which is
 * exactly right for a Story and too tall for the feed: Instagram's tallest
 * feed post is 4:5, so it would cut about 29% and take either the two logos
 * at the top or the venue line at the bottom. Neither is spare. Cropping a
 * design that was composed for one ratio into another is how you get a poster
 * with its head cut off, so this is composed for 4:5 from the start and the
 * flyer keeps the Story where it already fits.
 *
 * 1080×1350, not 1080×1080, on purpose. Four-five is the tallest thing the
 * feed allows, which means it occupies the most screen on a phone of anything
 * you can post there.
 *
 * THE DATES COME FROM THE DATABASE. Hardcoding "3 and 6 October" into a
 * graphic is how a poster ends up contradicting the event page after somebody
 * moves a night. It reads the same two rows migration-aitf-jollof-party.sql
 * writes, so the card cannot disagree with the thing it is advertising. If
 * those rows are missing it renders nothing rather than guessing.
 *
 * NO EMOJI. Satori ships no emoji font and the bundled face is Noto Sans
 * latin-ext, so anything past the currency block is tofu. The flyer's emoji
 * are dropped and the shapes here are drawn as divs, which is the same rule
 * ig-card/join follows.
 *
 * The palette is the flyer's, so the two read as one campaign: deep maroon
 * ground, gold, cream. The flag rule and the wordmark are the brand and stay
 * exactly as they are everywhere else.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;
const PAD = 64;

const MAROON = "#3D0A0E";
const MAROON_2 = "#5A1116";
const GOLD = "#F0B849";
const CREAM = "#FFF3E0";
const RED = "#C1272D";

/** The six that read at thumbnail size. The flyer carries all ten. */
const HIGHLIGHTS = [
  "Dance battle",
  "Rap battle",
  "Jollof eating challenge",
  "Trivia + best dressed",
  "Business pitch",
  "Grand giveaway",
];

function Flag() {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: `${W}px` }}>
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#008753" }} />
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#FFFFFF" }} />
      <div style={{ display: "flex", width: "360px", height: "12px", backgroundColor: "#008753" }} />
    </div>
  );
}

/** A date, as its own block, so two nights read as two nights. */
function NightChip({ day, date }: { day: string; date: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: GOLD,
        borderRadius: 24,
        paddingTop: 18,
        paddingBottom: 20,
        paddingLeft: 34,
        paddingRight: 34,
      }}
    >
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: MAROON, letterSpacing: "0.12em" }}>
        {day.toUpperCase()}
      </div>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: MAROON, marginTop: 2 }}>
        {date}
      </div>
    </div>
  );
}

/** Drawn, not typed: a bullet that cannot fall through to tofu. */
function Dot() {
  return (
    <div
      style={{
        display: "flex",
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: GOLD,
        marginRight: 18,
      }}
    />
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET() {
  /**
   * no-store, or this card lies about what is on.
   *
   * Next patches fetch in a route handler and caches GET responses, and
   * supabase-js goes through that same fetch. This route's request URL never
   * varies, so the FIRST answer it ever gets is the one it keeps giving. It
   * was first called while the events did not exist, and it then went on
   * returning an empty list long after they were created, insisting the
   * party was not happening.
   *
   * `dynamic = "force-dynamic"` does not cover this. That governs whether the
   * ROUTE is re-run, and the route was re-run every time; it was the fetch
   * inside it that was answering from cache.
   *
   * The other ig-card routes are keyed by an id in the path, so each one is a
   * separate cache entry and the trap never sprang. This one takes no
   * parameters, which is exactly what made it vulnerable.
   */
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
      },
    }
  );

  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("slug", "aitf")
    .maybeSingle();

  const { data: nights } = partner
    ? await supabase
        .from("events")
        .select("date, time, location")
        .eq("partner_id", (partner as { id: string }).id)
        .ilike("title", "%Jollof%")
        .order("date")
    : { data: null };

  const rows = (nights ?? []) as { date: string; time: string | null; location: string | null }[];
  if (rows.length === 0) {
    return new Response(
      "No Jollof Party events found. Run migration-aitf-jollof-party.sql first.",
      { status: 404 }
    );
  }

  // Parsed as plain numbers rather than through Date, which would apply the
  // server's timezone and can move a date across midnight.
  const chips = rows.slice(0, 2).map((r) => {
    const [y, m, d] = r.date.split("-").map(Number);
    const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { day: dow, date: `${d} ${MONTHS[m - 1]}` };
  });

  const fonts = await ogFonts();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: MAROON,
          backgroundImage: `linear-gradient(160deg, ${MAROON_2} 0%, ${MAROON} 55%)`,
          padding: PAD,
          paddingTop: PAD + 12,
          position: "relative",
        }}
      >
        <Flag />

        {/* ---------------------------------------------------- who ---- */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={46} height={46} style={{ width: 46, height: 46 }} />
            <div style={{ display: "flex", fontSize: 31, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
              Link<span style={{ color: "#8B83E6" }}>Up</span>Naija
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 23,
              fontWeight: 700,
              color: GOLD,
              letterSpacing: "0.08em",
            }}
          >
            AT THE ABUJA TRADE FAIR
          </div>
        </div>

        {/* -------------------------------------------------- the name ---- */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 54 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: CREAM, letterSpacing: "-0.03em" }}>
            AITF LinkUp
          </div>
          <div style={{ display: "flex", fontSize: 132, fontWeight: 700, color: GOLD, letterSpacing: "-0.04em", marginTop: -14 }}>
            Jollof Party
          </div>
        </div>

        {/* ------------------------------------------------ both nights ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 40 }}>
          {chips.map((c) => (
            <NightChip key={c.date} day={c.day} date={c.date} />
          ))}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: CREAM }}>5PM</div>
            <div style={{ display: "flex", fontSize: 25, fontWeight: 400, color: "rgba(255,243,224,0.65)" }}>
              till late
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: RED,
              borderRadius: 18,
              paddingTop: 14,
              paddingBottom: 14,
              paddingLeft: 26,
              paddingRight: 26,
              marginLeft: "auto",
              fontSize: 34,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.04em",
            }}
          >
            FREE
          </div>
        </div>

        {/* -------------------------------------------------- the night ---- */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 46, gap: 15 }}>
          {HIGHLIGHTS.map((h) => (
            <div key={h} style={{ display: "flex", alignItems: "center" }}>
              <Dot />
              <div style={{ display: "flex", fontSize: 40, fontWeight: 400, color: CREAM }}>{h}</div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------ where ---- */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              height: 2,
              width: "100%",
              backgroundColor: "rgba(255,243,224,0.18)",
              marginBottom: 26,
            }}
          />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            {/* The tagline used to be "Tap in, you're straight through",
                which wrapped to two lines at this size and ran into the
                address beside it. One line or it does not belong here. */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 730 }}>
              {/* The row's own location, not a copy of it. The constant that
                  used to sit here said "Abuja Chamber of Commerce Trade Fair
                  Complex" and dropped "and Industry" from the venue's actual
                  name — while this route was already fetching `location` and
                  throwing it away. */}
              <div style={{ display: "flex", fontSize: 26, fontWeight: 400, color: "rgba(255,243,224,0.7)" }}>
                {rows.find((r) => r.location)?.location?.trim() ?? ""}
              </div>
              <div style={{ display: "flex", fontSize: 31, fontWeight: 700, color: "#fff", marginTop: 10 }}>
                linkupnaija.com
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: GOLD, whiteSpace: "nowrap" }}>
              Tap to join
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );

  // next/og hardcodes a year of immutable caching, which pins a card made
  // before a date change into every browser that saw it.
  res.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
  );
  return res;
}
