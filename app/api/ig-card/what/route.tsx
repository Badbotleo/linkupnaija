import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * What LinkUpNaija is, for somebody who just landed on the account.
 *
 * ?v=hook|cities|names|who|host|close, ?ratio=story for the 1080x1920 cut.
 *
 * THE BRIEF WAS "NOT GENERIC" AND "GRABS ATTENTION", WHICH ARE THE SAME
 * NOTE. The generic version of this post writes itself and everybody has
 * seen it: "Find your people", "Real events near you", "Host your own", five
 * frames of eyebrow, headline, subhead, and a phone mockup. It says nothing
 * a reader could check and nothing a competitor could not copy by Tuesday.
 *
 * So no slide here makes a claim. Every slide states a FACT, at a size you
 * cannot ignore, and the explaining happens on its own:
 *
 *   49 upcoming link-ups     -> this is a thing with stuff on it
 *   23 Abuja, 20 Lagos       -> and it is where I live
 *   Iri Ji. DevFest. Gamathon -> and these are my people's events
 *   see who is going first   -> and it is not just a listings page
 *   N10,000 ticket, you keep N10,000 -> and hosting here is not a tax
 *
 * Every one of those is read from the database at render time, so the post
 * cannot drift from the product. A number nobody can check is an advert; a
 * number anybody can check by opening the app is a reason to open the app.
 *
 * THE EVENT NAMES ARE THE WHOLE POINT OF SLIDE THREE. A Nigerian scrolling
 * past "Find your people" keeps scrolling. Somebody who sees Iri Ji Festival
 * and DevFest Abuja in the same frame knows immediately which country and
 * which crowd this is, and that no template generated it.
 *
 * SATORI RULES, THE USUAL ONES. No WebP, it decodes to nothing silently.
 * Nothing clips. Every element with children carries display:flex. Anything
 * that points is drawn, because typed arrows are tofu in this subset.
 *
 * AND NO EMOJI, WHICH IS NOT OPTIONAL HERE. Two of the live titles are
 * literally "👟 ABUJA SNEAKERS FESTIVAL" and "📸 10TH ABUJA PHOTO FESTIVAL".
 * Satori ships no emoji font, so those render as tofu boxes in the middle of
 * a headline. Titles are stripped to what the bundled latin-ext face can
 * actually draw before they go anywhere near a frame.
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

/** A remote cover as a data URI, or null. Content type, not extension. */
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

/**
 * Everything the bundled face cannot draw, removed.
 *
 * Not a nicety: hosts put emoji in titles, and an emoji in Satori is a solid
 * tofu box. Keeps latin-ext, punctuation and the currency block, drops the
 * rest, then tidies the double spaces the removal leaves behind.
 */
function drawable(s: string): string {
  return (
    s
      // Folded to ASCII, not deleted. Deleting them cost real information:
      // "Iri Ji Festival Abuja 3.0 – Unifying Cultures" lost the en dash
      // before shortTitle could split on it, so the subtitle stayed attached
      // and the name came out as "Iri Ji Festival Abuja 3.0...". Curly quotes
      // and ellipses have the same problem in the other direction.
      .replace(/[‐-―]/g, "-")
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/…/g, "...")
      .replace(/[^ -ɏ₠-₿]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** Cut on a word boundary. Three dots, not U+2026, which is tofu here. */
function clip(s: string, n: number): string {
  const clean = drawable(s);
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  const space = cut.lastIndexOf(" ");
  return (
    (space > n * 0.55 ? cut.slice(0, space) : cut).replace(/[\s,:;&-]+$/, "") +
    "..."
  );
}

/**
 * The name people actually use, not the full billing.
 *
 * Hosts write the whole lot into the title: "Madness in Blaq House: Rhythm &
 * Rage MUTS x Blaq House", "Iri Ji Festival Abuja 3.0 - Unifying Cultures".
 * Clipping that at a character count gave "Madness in Blaq House: Rhythm
 * &..." on the slide, which looks like the renderer broke rather than like a
 * long title. Everything from the first colon or dash is the subtitle, and
 * the part before it is the name somebody would say out loud, so that is
 * what goes on a poster.
 */
function shortTitle(s: string, n: number): string {
  const clean = drawable(s);
  // Also " by ", which is the organiser credit rather than the name: "Kick n
  // Vibe by Vibes and Roulette" is Kick n Vibe to everyone who goes to it.
  const head = clean.split(/\s*[:–—]\s*|\s+-\s+|\s+by\s+/i)[0].trim();
  // Only take the head if it is still a name rather than a fragment.
  const base = head.length >= 8 ? head : clean;
  return clip(base.replace(/[\s,:;&-]+$/, ""), n);
}

/** "FCT - Abuja" is a database value, not a word anybody says. */
function cityName(state: string | null): string {
  if (!state) return "Nigeria";
  return drawable(state.replace(/^FCT\s*-\s*/i, "").trim()) || "Nigeria";
}

interface Ev {
  title: string;
  state: string | null;
  price: number | null;
  src: string | null;
}

interface Facts {
  total: number;
  cities: { name: string; n: number }[];
  events: Ev[];
  /**
   * The MIDDLE live ticket price, used to make the host slide concrete.
   *
   * The first cut used the dearest, which is how the slide ended up saying
   * "Ticket N100,000". That is a real number and a useless one: it is one
   * outlier out of forty-eight, it is not what anybody reading this would
   * charge, and at that size it reads as a boast. The median is the price a
   * host would actually recognise as theirs.
   */
  midPrice: number;
}

/**
 * The post's contents, read live.
 *
 * Covers are inlined here rather than in the frame so a slide never waits on
 * a picture it is not going to use, and so one unreachable flyer cannot take
 * a slide down with it.
 */
async function facts(): Promise<Facts> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("events")
    .select("title, state, price, cover_image_url, date")
    .eq("event_type", "general")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(200);

  const rows = (data ?? []) as {
    title: string;
    state: string | null;
    price: number | null;
    cover_image_url: string | null;
  }[];

  const byCity = new Map<string, number>();
  for (const r of rows) {
    const c = cityName(r.state);
    byCity.set(c, (byCity.get(c) ?? 0) + 1);
  }
  const cities = Array.from(byCity, ([name, n]) => ({ name, n })).sort(
    (a, b) => b.n - a.n
  );

  // Covers, best effort, in date order. Eight is more than any slide uses.
  const events: Ev[] = [];
  for (const r of rows) {
    if (events.length >= 8) break;
    if (!r.cover_image_url) continue;
    const src = await inlineImage(r.cover_image_url);
    if (!src) continue;
    events.push({ title: r.title, state: r.state, price: r.price, src });
  }

  const paid = rows
    .map((r) => r.price ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  return {
    total: rows.length,
    cities,
    events,
    midPrice: paid.length ? paid[Math.floor(paid.length / 2)] : 0,
  };
}

/** Naira, grouped. The sign needs the latin-ext face, which ogFonts loads. */
function naira(n: number): string {
  return "₦" + n.toLocaleString("en-NG");
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
  const want = url.searchParams.get("v") ?? "hook";

  const f = await facts();
  const pic = (i: number) => f.events[i % Math.max(1, f.events.length)]?.src ?? null;

  /** The sign-off every slide carries, because slide four gets seen alone. */
  const Footer = ({ on = "dark" }: { on?: "dark" | "light" }) => (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: t(64),
        bottom: v(52),
        alignItems: "center",
        gap: t(14),
      }}
    >
      <img src={LOGO_MARK_DATA_URI} width={t(38)} height={t(38)} />
      <div
        style={{
          display: "flex",
          fontSize: t(25),
          fontWeight: 700,
          letterSpacing: t(-0.4),
          color: on === "dark" ? "rgba(255,255,255,0.82)" : "rgba(11,11,15,0.6)",
        }}
      >
        linkupnaija.com
      </div>
    </div>
  );

  const render = (node: JSX.Element) =>
    new ImageResponse(node, { width: W, height: H, fonts });

  /* ---------------- HOOK: the number, at poster size ---------------- */
  if (want === "hook") {
    return render(
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
        {/* Flyers own the top outright. A scrim over the whole frame with
            type floating in the middle is the stock move, and the type ends
            up fighting six posters for the same attention. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: Math.round(H * 0.46),
          }}
        >
          {[0, 1, 2].map((i) =>
            pic(i) ? (
              <img
                key={i}
                src={pic(i)!}
                width={Math.round(W / 3)}
                height={Math.round(H * 0.46)}
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div
                key={i}
                style={{
                  display: "flex",
                  width: Math.round(W / 3),
                  height: Math.round(H * 0.46),
                  background: i % 2 ? BRAND_DEEP : BRAND,
                }}
              />
            )
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: t(64),
            right: t(64),
            top: Math.round(H * 0.46) + v(64),
          }}
        >
          {/* The number IS the hook. It is checkable, it changes every week,
              and no competitor can post ours. */}
          <div
            style={{
              display: "flex",
              fontSize: t(230),
              fontWeight: 700,
              lineHeight: 0.84,
              letterSpacing: t(-12),
              color: GOLD,
            }}
          >
            {f.total}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: v(14),
              fontSize: t(70),
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: t(-2.6),
              color: PAPER,
            }}
          >
            link-ups happening
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(70),
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: t(-2.6),
              color: PAPER,
            }}
          >
            in Nigeria right now
          </div>
          <div
            style={{
              display: "flex",
              marginTop: v(22),
              fontSize: t(30),
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Swipe. They are all real.
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  /* ---------------- CITIES: where, in their own words -------------- */
  if (want === "cities") {
    const top = f.cities.slice(0, 5);
    return render(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          // Top, rows, caption, each taking what it needs and the gaps
          // absorbing the rest. The first cut stacked everything from the top
          // and left the bottom third of a 1350px frame empty, which on a
          // phone reads as a post that failed to finish rendering.
          justifyContent: "space-between",
          padding: `${v(74)}px ${t(64)}px ${v(150)}px`,
          background: PAPER,
          fontFamily: "Noto Sans",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: t(62),
            fontWeight: 700,
            letterSpacing: t(-2.2),
            color: INK,
          }}
        >
          Where they are
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", marginTop: v(26) }}
        >
          {top.map((c, i) => (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: v(30),
                paddingBottom: v(30),
                borderBottom: `${t(2)}px solid rgba(11,11,15,0.09)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: t(i === 0 ? 76 : 62),
                  fontWeight: 700,
                  letterSpacing: t(-2.2),
                  color: i === 0 ? BRAND : INK,
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: t(i === 0 ? 76 : 62),
                  fontWeight: 700,
                  letterSpacing: t(-2.2),
                  color: i === 0 ? BRAND : "rgba(11,11,15,0.45)",
                }}
              >
                {c.n}
              </div>
            </div>
          ))}
        </div>

        {/* Honest about the thin ones. A city with three link-ups is told it
            has three; claiming a nationwide spread we do not have is how the
            first person outside Lagos and Abuja stops believing the account. */}
        <div
          style={{
            display: "flex",
            marginTop: v(30),
            fontSize: t(34),
            lineHeight: 1.4,
            color: "rgba(11,11,15,0.55)",
          }}
        >
          Not in your city yet? Host the first one and we will put it in front
          of everybody here.
        </div>

        <Footer on="light" />
      </div>
    );
  }

  /* ---------------- NAMES: the proof nobody can template ----------- */
  if (want === "names") {
    // Six, at a size where the real titles fit whole. Five at 68px left two of
    // them trailing dots and wrapped a third onto a second line, which makes a
    // list of actual event names look like a rendering fault. The names are
    // the entire argument of this slide, so they get to be complete.
    const names = f.events.slice(0, 6).map((e) => shortTitle(e.title, 32));
    return render(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: `${v(74)}px ${t(64)}px ${v(150)}px`,
          background: BRAND_DEEP,
          fontFamily: "Noto Sans",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: t(30),
            fontWeight: 700,
            letterSpacing: t(3),
            color: GOLD,
          }}
        >
          ON RIGHT NOW
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: v(30),
          }}
        >
          {names.map((n, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                marginBottom: v(18),
                fontSize: t(60),
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: t(-2.2),
                color: PAPER,
              }}
            >
              {n}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: v(16),
            fontSize: t(33),
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.62)",
          }}
        >
          Real names, real nights, posted by the people running them.
        </div>

        <Footer />
      </div>
    );
  }

  /* ---------------- WHO: the part that is not a listings page ------ */
  if (want === "who") {
    const e = f.events[0];
    return render(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingBottom: v(150),
          background: GOLD,
          fontFamily: "Noto Sans",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: `${v(74)}px ${t(64)}px ${v(30)}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(72),
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: t(-2.8),
              color: INK,
            }}
          >
            You see who else
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(72),
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: t(-2.8),
              color: INK,
            }}
          >
            is going first.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: v(18),
              fontSize: t(33),
              lineHeight: 1.4,
              color: "rgba(11,11,15,0.66)",
            }}
          >
            Before you pay. Before you show up alone.
          </div>
        </div>

        {/* The mechanic, drawn as the card it actually is in the app, on a
            real flyer. A screenshot would be unreadable at this size and a
            grey rectangle would be the thing we got told off for.

            IN FLOW, NOT PINNED TO THE BOTTOM. Absolutely positioned at
            bottom: 150 it left a third of a frame of empty gold between the
            subhead and the card, which reads as a post that did not finish
            loading. It now sits directly under the words it illustrates and
            takes the space it needs. */}
        <div
          style={{
            display: "flex",
            margin: `0 ${t(64)}px`,
            borderRadius: t(28),
            overflow: "hidden",
            background: INK,
          }}
        >
          {pic(0) ? (
            <img
              src={pic(0)!}
              width={t(380)}
              height={v(520)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{ display: "flex", width: t(380), height: v(520), background: BRAND }}
            />
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingLeft: t(36),
              paddingRight: t(30),
              width: t(572),
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: t(36),
                fontWeight: 700,
                lineHeight: 1.16,
                letterSpacing: t(-1),
                color: PAPER,
              }}
            >
              {e ? clip(e.title, 42) : "Saturday night in Lagos"}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: v(26),
              }}
            >
              {[GOLD, "#7FB069", "#E86A5C"].map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: t(54),
                    height: t(54),
                    marginLeft: i === 0 ? 0 : t(-16),
                    borderRadius: t(27),
                    background: c,
                    border: `${t(4)}px solid ${INK}`,
                  }}
                />
              ))}
              <div
                style={{
                  display: "flex",
                  marginLeft: t(18),
                  fontSize: t(30),
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                3 of your paddies are going
              </div>
            </div>
          </div>
        </div>

        {/* The reason, said the way somebody would say it. Also structural:
            with only the header and the card, space-between had nothing to
            distribute and parked a third of a frame of empty gold between
            them. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: `0 ${t(64)}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: t(40),
              fontWeight: 700,
              lineHeight: 1.22,
              letterSpacing: t(-1.2),
              color: INK,
            }}
          >
            Nobody wants to be the only
          </div>
          <div
            style={{
              display: "flex",
              fontSize: t(40),
              fontWeight: 700,
              lineHeight: 1.22,
              letterSpacing: t(-1.2),
              color: INK,
            }}
          >
            one who came.
          </div>
        </div>

        <Footer on="light" />
      </div>
    );
  }

  /* ---------------- HOST: the number that surprises people --------- */
  if (want === "host") {
    // A real live ticket price, so the sum on the slide is one somebody can
    // go and check against an actual event rather than a worked example.
    const price = f.midPrice >= 1000 ? f.midPrice : 5000;
    const fee = Math.round(price * 0.09);
    return render(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: `${v(74)}px ${t(64)}px ${v(150)}px`,
          background: GREEN,
          fontFamily: "Noto Sans",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: t(30),
            fontWeight: 700,
            letterSpacing: t(3),
            color: GOLD,
          }}
        >
          IF YOU HOST
        </div>

        <div
          style={{
            display: "flex",
            marginTop: v(36),
            fontSize: t(44),
            color: "rgba(255,255,255,0.72)",
          }}
        >
          Ticket
        </div>
        <div
          style={{
            display: "flex",
            fontSize: t(104),
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: t(-4),
            color: PAPER,
          }}
        >
          {naira(price)}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: v(40),
            fontSize: t(44),
            color: "rgba(255,255,255,0.72)",
          }}
        >
          You keep
        </div>
        <div
          style={{
            display: "flex",
            fontSize: t(150),
            fontWeight: 700,
            lineHeight: 0.96,
            letterSpacing: t(-7),
            color: GOLD,
          }}
        >
          {naira(price)}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: v(34),
            fontSize: t(35),
            lineHeight: 1.38,
            color: "rgba(255,255,255,0.86)",
          }}
        >
          All of it. Our {naira(fee)} fee goes on top, paid by the guest, not
          taken out of you.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: v(14),
            fontSize: t(31),
            lineHeight: 1.38,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Money lands after the night. You see who paid, every time.
        </div>

        <Footer />
      </div>
    );
  }

  /* ---------------- CLOSE ------------------------------------------ */
  return render(
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
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          bottom: 0,
          width: W,
          height: Math.round(H * 0.52),
        }}
      >
        {[3, 4, 5].map((i, k) =>
          pic(i) ? (
            <img
              key={i}
              src={pic(i)!}
              width={Math.round(W / 3)}
              height={Math.round(H * 0.52)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              key={i}
              style={{
                display: "flex",
                width: Math.round(W / 3),
                height: Math.round(H * 0.52),
                background: k % 2 ? BRAND_DEEP : BRAND,
              }}
            />
          )
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: t(64),
          right: t(64),
          top: v(96),
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: t(78),
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: t(-3),
            color: PAPER,
          }}
        >
          Free to look.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: t(78),
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: t(-3),
            color: GOLD,
          }}
        >
          linkupnaija.com
        </div>
        <div
          style={{
            display: "flex",
            marginTop: v(22),
            fontSize: t(33),
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.62)",
          }}
        >
          An account is only for joining. Follow for the week ahead, every
          week.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          left: t(64),
          top: v(96) + v(352),
          alignItems: "center",
          gap: t(14),
        }}
      >
        <img src={LOGO_MARK_DATA_URI} width={t(44)} height={t(44)} />
        <div
          style={{
            display: "flex",
            fontSize: t(30),
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          @linkupnaijaofficial
        </div>
      </div>
    </div>
  );
}
