import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import { doodleField } from "@/lib/doodle-field";
import { pngsToPdf } from "@/lib/print-pdf";

/**
 * The business plan, as a document somebody can send an investor.
 *
 * WHY THIS EXISTS RATHER THAN AN EXPORT. The plan lives as a Claude doc,
 * which is right for writing it and wrong for sending it: an export carries
 * no mark, no colour and no sense that anybody designed it. A person deciding
 * whether to put money into a design-led consumer product reads the document
 * as evidence about the product. A plain export argues against us.
 *
 * SIX PAGES, FIXED. Satori does not paginate: it lays out what it is given
 * and draws past the bottom of the canvas if there is too much, silently.
 * So each page is composed by hand at a known size, which also forces the
 * document to stay short. Anything that does not fit is a thing to cut, and
 * on a plan for a busy reader that is the right pressure.
 *
 * ?page=1..6   one page as a PNG, for checking
 * ?format=pdf  all six, as A4 at the real physical size
 * ?dpi=        200 by default. Text at 200dpi prints perfectly well and
 *              renders in a fraction of the time 300 takes.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Six A4 renders plus the decode back out of them. Nothing waits on it. */
export const maxDuration = 120;

const INK = "#160D33";
const VIOLET = "#534AB7";
const CREAM = "#FFF6EC";
const GOLD = "#B07A00";
const RED = "#C1272D";
const GREEN = "#008753";
const MUTED = "rgba(22,13,51,0.58)";
const RULE = "rgba(22,13,51,0.14)";

/* ------------------------------------------------------------- furniture -- */

function Flag({ w, t }: { w: number; t: number }) {
  return (
    <div style={{ display: "flex", width: w }}>
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: GREEN }} />
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: "#FFFFFF" }} />
      <div style={{ display: "flex", width: w / 3, height: t, backgroundColor: GREEN }} />
    </div>
  );
}

/** The running head and the page number, on every page but the cover. */
function Chrome({ u, w, page }: { u: (n: number) => number; w: number; page: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: u(52),
        paddingBottom: u(24),
        borderBottom: `${Math.max(1, u(2))}px solid ${RULE}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: u(12) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_MARK_DATA_URI} alt="" width={u(36)} height={u(36)} style={{ width: u(36), height: u(36) }} />
        <div style={{ display: "flex", fontSize: u(25), fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
          Link<span style={{ color: VIOLET }}>Up</span>Naija
        </div>
      </div>
      <div style={{ display: "flex", fontSize: u(20), fontWeight: 700, letterSpacing: "0.12em", color: MUTED }}>
        {`BUSINESS PLAN · ${page} OF 6`}
      </div>
    </div>
  );
}

function Sub({ u, children, tone }: { u: (n: number) => number; children: string; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: u(20),
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: tone ?? MUTED,
        marginBottom: u(10),
      }}
    >
      {children}
    </div>
  );
}

function H({ u, children }: { u: (n: number) => number; children: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: u(52),
        fontWeight: 700,
        color: INK,
        letterSpacing: "-0.025em",
        marginBottom: u(24),
      }}
    >
      {children}
    </div>
  );
}

function P({ u, children, tone }: { u: (n: number) => number; children: string; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: u(29),
        lineHeight: 1.5,
        color: tone ?? INK,
        marginBottom: u(18),
      }}
    >
      {children}
    </div>
  );
}

/**
 * A row of a table.
 *
 * `cols` are flex weights rather than widths, so one definition serves the
 * two-column figure tables and the four-column scorecards without anybody
 * working out pixels.
 */
function Row({
  u,
  cells,
  cols,
  head,
  strong,
  tone,
}: {
  u: (n: number) => number;
  cells: string[];
  cols: number[];
  head?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        paddingTop: u(18),
        paddingBottom: u(18),
        borderBottom: `${Math.max(1, u(2))}px solid ${RULE}`,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexGrow: cols[i],
            flexBasis: 0,
            justifyContent: i === 0 ? "flex-start" : "flex-end",
            fontSize: head ? u(21) : u(29),
            fontWeight: head || strong ? 700 : 400,
            letterSpacing: head ? "0.12em" : "0",
            color: head ? MUTED : strong ? (tone ?? INK) : i === 0 ? INK : (tone ?? INK),
          }}
        >
          {head ? c.toUpperCase() : c}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- the pages -- */

interface Ctx {
  u: (n: number) => number;
  W: number;
  H: number;
  pad: number;
}

function Page({ ctx, page, children }: { ctx: Ctx; page: number; children: React.ReactNode }) {
  const { u, W, H: PH, pad } = ctx;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml,${encodeURIComponent(doodleField(W, PH, "rgba(22,13,51,0.028)", 16))}`}
        alt=""
        width={W}
        height={PH}
        style={{ position: "absolute", top: 0, left: 0, width: W, height: PH }}
      />
      <Flag w={W} t={u(10)} />
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: `${u(38)}px ${pad}px ${u(34)}px` }}>
        <Chrome u={u} w={W} page={page} />
        {children}
      </div>
    </div>
  );
}

function Cover(ctx: Ctx) {
  const { u, W, H: PH, pad } = ctx;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: INK,
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml,${encodeURIComponent(doodleField(W, PH, "rgba(255,255,255,0.05)", 16))}`}
        alt=""
        width={W}
        height={PH}
        style={{ position: "absolute", top: 0, left: 0, width: W, height: PH }}
      />
      <Flag w={W} t={u(14)} />

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: `${u(90)}px ${pad}px ${u(70)}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: u(20) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={u(76)} height={u(76)} style={{ width: u(76), height: u(76) }} />
          <div style={{ display: "flex", fontSize: u(52), fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.025em" }}>
            Link<span style={{ color: "#A79BFF" }}>Up</span>Naija
          </div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div style={{ display: "flex", fontSize: u(18), fontWeight: 700, letterSpacing: "0.18em", color: "#FFC93C" }}>
          BUSINESS AND FINANCIAL PLAN
        </div>
        <div
          style={{
            display: "flex",
            fontSize: u(72),
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-0.04em",
            lineHeight: 1.06,
            marginTop: u(22),
          }}
        >
          Find your people.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: u(72),
            fontWeight: 700,
            color: "#A79BFF",
            letterSpacing: "-0.04em",
            lineHeight: 1.06,
          }}
        >
          Build real connections.
        </div>

        <div style={{ display: "flex", width: u(110), height: u(5), backgroundColor: "#FFC93C", marginTop: u(40) }} />

        <div style={{ display: "flex", fontSize: u(24), color: "rgba(255,255,255,0.78)", lineHeight: 1.45, marginTop: u(34), width: u(760) }}>
          A platform for finding real events near you and the people going to them. Live since July 2026.
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: u(26),
            borderTop: `${Math.max(1, u(2))}px solid rgba(255,255,255,0.2)`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: u(16), fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}>
              RAISING
            </div>
            <div style={{ display: "flex", fontSize: u(46), fontWeight: 700, color: "#FFC93C", marginTop: u(6) }}>
              ₦10,000,000
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: u(22), fontWeight: 700, color: "#FFFFFF" }}>linkupnaija.com</div>
            <div style={{ display: "flex", fontSize: u(19), color: "rgba(255,255,255,0.6)", marginTop: u(6) }}>
              8 October 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageTwo(ctx: Ctx) {
  const { u } = ctx;
  const c2 = [3, 1];
  return (
    <Page ctx={ctx} page={2}>
      <H u={u}>Where we are</H>
      <P u={u} tone={MUTED}>Read from the live database on 8 October 2026.</P>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(26) }}>
        <Row u={u} cols={c2} cells={["Members", "290"]} />
        <Row u={u} cols={c2} cells={["Joined in the last 30 days", "181"]} />
        <Row u={u} cols={c2} cells={["Active in the last 30 days", "118"]} />
        <Row u={u} cols={c2} cells={["Events hosted", "262"]} />
        <Row u={u} cols={c2} cells={["Venues listed", "304"]} />
        <Row u={u} cols={c2} cells={["Ticket sales to date", "₦25,500"]} />
        <Row u={u} cols={c2} cells={["Revenue to date", "₦7,349"]} strong tone={RED} />
      </div>
      <P u={u}>
        181 of 290 members joined in the last month, so growth is accelerating. 118 of 290 were active in
        that month, a 41% monthly active rate, which is healthy for a product this young.
      </P>
      <P u={u} tone={RED}>
        Revenue is real but tiny. ₦25,500 of tickets have sold and we earned ₦2,350 of that, which is the
        9% working exactly as designed at a volume that proves nothing yet. Premium adds ₦4,999 on top.
      </P>

      <div style={{ display: "flex", height: u(34) }} />

      <H u={u}>How it makes money</H>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(22) }}>
        <Row u={u} cols={[2, 4, 2]} cells={["Line", "Terms", "Status"]} head />
        <Row u={u} cols={[2, 4, 2]} cells={["Ticket fees", "Buyer pays 9% on top, host keeps 100%", "Live"]} />
        <Row u={u} cols={[2, 4, 2]} cells={["Premium", "₦4,999 per member per month", "Live, 1 paying"]} />
        <Row u={u} cols={[2, 4, 2]} cells={["Venue reservations", "Commission agreed per booking, 304 listed", "Built"]} />
        <Row u={u} cols={[2, 4, 2]} cells={["Rides to events", "About ₦4,100 for a typical Abuja trip", "Built"]} />
      </div>
      <P u={u} tone={MUTED}>
        Free events stay free to list and free to attend. Supply of events is the constraint, and charging
        to list would choke it.
      </P>

      <div style={{ display: "flex", height: u(34) }} />

      <H u={u}>Collaborations</H>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Row u={u} cols={[3.4, 2.6]} cells={["Abuja International Trade Fair", "AITF LinkUp Jollof Party, 6 October 2026"]} />
        <Row u={u} cols={[3.4, 2.6]} cells={["DEFCON", "Summer Games, co-branded campaign page"]} />
      </div>
    </Page>
  );
}

function PageThree(ctx: Ctx) {
  const { u } = ctx;
  const c5 = [2.2, 1.1, 1.4, 1.6, 1, 1];
  return (
    <Page ctx={ctx} page={3}>
      <H u={u}>The three-year plan</H>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(22) }}>
        <Row u={u} cols={c5} cells={["Milestone", "Due", "Actives", "Revenue", "Events", "Hosts"]} head />
        <Row u={u} cols={c5} cells={["Month 3", "Sep 26", "500", "₦500,000", "50", "20"]} />
        <Row u={u} cols={c5} cells={["Month 6", "Dec 26", "2,000", "₦2m", "200", "100"]} />
        <Row u={u} cols={c5} cells={["Year 1", "Jun 27", "5,000", "₦5m", "500", "300"]} />
        <Row u={u} cols={c5} cells={["Year 2", "Jun 28", "50,000", "₦30m", "5,000", "3,000"]} />
        <Row u={u} cols={c5} cells={["Year 3", "Jun 29", "500,000", "₦150m", "25,000", "15,000"]} strong tone={VIOLET} />
      </div>
      <P u={u}>
        At Year 3, 15,000 Premium members alone is ₦75m a month, half the target. The other half is 9% of
        ticket sales. Reservations and rides are counted at zero throughout because they are unproven, and
        they are the reason I think Year 3 is conservative.
      </P>

      <div style={{ display: "flex", height: u(40) }} />

      <H u={u}>Against the plan</H>
      <P u={u} tone={MUTED}>Month 3 fell due on 30 September 2026.</P>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(22) }}>
        <Row u={u} cols={[3, 1.6, 1.6, 1.2]} cells={["Target", "Plan", "Actual", ""]} head />
        <Row u={u} cols={[3, 1.6, 1.6, 1.2]} cells={["Monthly actives", "500", "118", "missed"]} tone={RED} />
        <Row u={u} cols={[3, 1.6, 1.6, 1.2]} cells={["Monthly revenue", "₦500,000", "₦7,349 to date", "missed"]} tone={RED} />
        <Row u={u} cols={[3, 1.6, 1.6, 1.2]} cells={["Active hosts", "20", "about 3", "missed"]} tone={RED} />
        <Row u={u} cols={[3, 1.6, 1.6, 1.2]} cells={["Events per month", "50", "76", "met"]} tone={GREEN} />
      </div>
      <P u={u}>
        We hit the one that is easiest to manufacture. Most of those 76 events were created by us, not by
        the community. The three we missed are the three that decide whether this is a business.
      </P>
      <P u={u}>
        Month 6 asks for ₦2m a month, twelve weeks from now, against ₦7,349 earned since launch. That will
        not happen and the milestone needs restating.
      </P>
    </Page>
  );
}

function PageFour(ctx: Ctx) {
  const { u } = ctx;
  const cc = [1.9, 1.7, 1.3, 1.1, 1];
  return (
    <Page ctx={ctx} page={4}>
      {/* The question every investor asks within two minutes is why Meta has
          not already done this. Answering it as a comparison is standard and
          useful; claiming to be the next Facebook is the line that makes
          somebody stop reading, so the section is framed as the gap they
          leave rather than as a likeness. */}
      <H u={u}>Why this is not already solved</H>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(22) }}>
        <Row u={u} cols={cc} cells={["", "Find something", "Who is going", "Approved", "Tickets"]} head />
        <Row u={u} cols={cc} cells={["Facebook Events", "Only your feed", "Unfiltered", "No", "No"]} />
        <Row u={u} cols={cc} cells={["Instagram", "Only your feed", "No", "No", "No"]} />
        <Row u={u} cols={cc} cells={["Tix, Eventbrite", "No", "No", "No", "Yes"]} />
        <Row u={u} cols={cc} cells={["WhatsApp groups", "If you are in it", "Yes", "By invite", "No"]} />
        <Row u={u} cols={cc} cells={["LinkUpNaija", "Yes", "Yes", "Yes", "Yes"]} strong tone={VIOLET} />
      </div>
      <P u={u}>
        Facebook and Instagram distribute events to people who already follow the host. That is the exact
        opposite of the problem, which is people with no network. Ticketing platforms sell a seat to
        somebody who has already decided to go. WhatsApp is where plans actually get made and you have to
        be in the group first.
      </P>
      <P u={u} tone={MUTED}>
        Meta could build this. The answer is the same as the risk on the next page: the defensible part is
        the host relationships and the local supply, not the software.
      </P>

      <div style={{ display: "flex", height: u(30) }} />

      <H u={u}>LinkUp Africa</H>
      <P u={u}>
        The product is not Nigerian. The flag, the naira and the venue list are. Everything else works
        anywhere people go out.
      </P>
      <P u={u}>
        We expand city by city, not country by country, and we learned why inside Nigeria. 70% of our
        audience is in Lagos and 16% in Abuja. Those two carry their own feeds. Every other state sees a
        national feed, because showing somebody an event they cannot reach is worse than showing them
        nothing. A city opens when it can carry a feed on its own.
      </P>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(22) }}>
        <Row u={u} cols={[1.5, 3.3, 1.5]} cells={["Now", "Lagos and Abuja", "Live"]} />
        <Row u={u} cols={[1.5, 3.3, 1.5]} cells={["Year 1", "Port Harcourt, Ibadan, as they reach density", "Jun 2027"]} />
        <Row u={u} cols={[1.5, 3.3, 1.5]} cells={["Year 2", "Nigeria, state by state, on the same rule", "Jun 2028"]} />
        <Row u={u} cols={[1.5, 3.3, 1.5]} cells={["Year 3 to 4", "First markets outside Nigeria: Accra, then Nairobi", "2029 to 2030"]} strong tone={VIOLET} />
      </div>
      <P u={u}>
        Leaving Nigeria is three to four years out and the wait is the strategy, not timidity. Nigeria is
        over 200 million people and we have not finished Lagos. Crossing a border before you have won the
        market you already understand is how companies this size die.
      </P>
      <P u={u} tone={RED}>
        When we do go, the barrier will not be demand, it will be payments. We take naira through Paystack
        and nothing else. Cedi and shilling are each a currency, a payout rail and a compliance
        conversation before a single ticket sells. That is a Year 3 problem and it is the real cost of
        LinkUp Africa.
      </P>
    </Page>
  );
}

function PageFive(ctx: Ctx) {
  const { u } = ctx;
  return (
    <Page ctx={ctx} page={5}>
      <H u={u}>What the ₦10m buys</H>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(26) }}>
        <Row u={u} cols={[4, 1.4]} cells={["Events and logistics, about 20 at ₦200,000", "₦4,000,000"]} />
        <Row u={u} cols={[4, 1.4]} cells={["Marketing and advertising", "₦2,500,000"]} />
        <Row u={u} cols={[4, 1.4]} cells={["Host recruitment and incentives", "₦1,500,000"]} />
        <Row u={u} cols={[4, 1.4]} cells={["One community manager, ₦200,000 a month", "₦1,200,000"]} />
        <Row u={u} cols={[4, 1.4]} cells={["Operations and contingency", "₦800,000"]} />
        <Row u={u} cols={[4, 1.4]} cells={["Total", "₦10,000,000"]} strong tone={VIOLET} />
      </div>

      <P u={u}>
        Events are the largest line on purpose, and paid social is the second because it already works.
        ₦76,400 on TikTok over two months produced 144,000 video views and 2,329 visits to the site, which
        is no worse than ₦33 a visit. But the advertising only has something to show because events
        happen. One spend feeds the ads, the ticket sales that prove the model, and the host pipeline,
        because the people worth recruiting to host are the ones who came to something good first. The
        ₦200,000 is what the AITF Jollof Party actually cost us.
      </P>

      <P u={u} tone={MUTED}>By 31 December 2026:</P>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(26) }}>
        <Row u={u} cols={[3, 1.4, 1.4]} cells={["", "Today", "Target"]} head />
        <Row u={u} cols={[3, 1.4, 1.4]} cells={["Monthly actives", "118", "800"]} />
        <Row u={u} cols={[3, 1.4, 1.4]} cells={["Active community hosts", "about 3", "25"]} />
        <Row u={u} cols={[3, 1.4, 1.4]} cells={["Paying Premium subscribers", "1", "25"]} />
        <Row u={u} cols={[3, 1.4, 1.4]} cells={["Revenue", "₦7,349 to date", "₦250,000 a month"]} strong tone={VIOLET} />
      </div>
      <P u={u} tone={MUTED}>
        Below the written Month 6 milestone, above anything we reach unfunded. I would rather give a number
        I can be held to.
      </P>

      <div style={{ display: "flex", height: u(30) }} />

      <H u={u}>The main risk</H>
      <P u={u}>
        Around three community hosts is not a marketplace. If hosts do not materialise even with paid
        people supporting them, this is a listings site rather than a platform, and worth much less. That
        is why events are the biggest line rather than salaries: the people worth recruiting to host are
        the ones who came to something good first.
      </P>

    </Page>
  );
}

function PageSix(ctx: Ctx) {
  const { u } = ctx;
  const c2 = [2.6, 2.4];
  return (
    <Page ctx={ctx} page={6}>
      <H u={u}>What you get</H>

      {/* A convertible note first, on purpose. Pricing a company with ₦2,350
          of lifetime revenue produces a number somebody invented, and both
          ways it can be wrong are expensive: too low caps the next raise,
          too high leaves a family member feeling sold to. The note defers
          the price until there is something to price it on. */}
      <Sub u={u} tone={VIOLET}>PREFERRED: A CONVERTIBLE NOTE</Sub>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(18) }}>
        <Row u={u} cols={[2.6, 2.4]} cells={["Amount", "₦10,000,000"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Valuation cap", "₦150,000,000"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Discount", "20%"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Converts", "At the next priced round"]} />
      </div>
      <P u={u}>
        Nobody prices the company today. If the next round prices at or below ₦150m you convert at a 20%
        discount to it; above that you convert at ₦150m. You are paid for being first without either of us
        pretending we can value a company with ₦7,349 of revenue to date.
      </P>

      <Sub u={u}>OR, ORDINARY SHARES</Sub>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(18) }}>
        <Row u={u} cols={[2.6, 2.4]} cells={["Investment", "₦10,000,000"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Equity", "10%, at ₦100,000,000 post-money"]} />
      </div>

      <Sub u={u}>EITHER WAY</Sub>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: u(24) }}>
        <Row u={u} cols={[2.6, 2.4]} cells={["Company", "Link Up Naija Limited"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Registration", "RC 9700712, Nigeria"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Reporting", "Written update every quarter"]} />
        <Row u={u} cols={[2.6, 2.4]} cells={["Access", "The admin dashboard, the numbers I see"]} />
      </div>

      <H u={u}>Honestly about the return</H>
      <P u={u}>
        No dividends for years; every naira goes back into growth. Your money comes back through a later
        round at a higher valuation or an acquisition. Both are possible, neither is promised, and if the
        host problem is not solved the realistic outcome is that you lose it. I would rather you decided
        knowing that than found out afterwards.
      </P>

      <div style={{ display: "flex", flexGrow: 1 }} />

      {/* The ask, as the last thing in the document and the only panel in it.
          A number somebody has to act on should not be a paragraph like every
          other paragraph. */}
      <div style={{ display: "flex", flexDirection: "column", backgroundColor: INK, borderRadius: u(14), padding: u(46) }}>
        <div style={{ display: "flex", fontSize: u(21), fontWeight: 700, letterSpacing: "0.16em", color: "#FFC93C" }}>
          THE ASK
        </div>
        <div style={{ display: "flex", fontSize: u(54), fontWeight: 700, color: "#FFFFFF", marginTop: u(16), letterSpacing: "-0.02em" }}>
          ₦10,000,000, as a note.
        </div>
        <div style={{ display: "flex", fontSize: u(27), color: "rgba(255,255,255,0.78)", marginTop: u(18), lineHeight: 1.5 }}>
          If you think the plan is wrong, telling me where would be worth as much to me as the money. Every
          figure here comes from the live database or our written growth plan.
        </div>
        <div style={{ display: "flex", fontSize: u(28), fontWeight: 700, color: "#A79BFF", marginTop: u(22) }}>
          linkupnaija.com
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ GET -- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dpi = Math.min(400, Math.max(72, Number(url.searchParams.get("dpi")) || 200));
  const px = (mm: number) => Math.round((mm / 25.4) * dpi);

  const W = px(210);
  const PH = px(297);
  /** Proportional unit against a 1654px-wide A4, so type scales with dpi. */
  const u = (n: number) => Math.max(1, Math.round((n / 1654) * W));
  const ctx: Ctx = { u, W, H: PH, pad: u(96) };

  const fonts = await ogFonts();
  const build = [Cover, PageTwo, PageThree, PageFour, PageFive, PageSix];

  const wanted = Number(url.searchParams.get("page"));
  const asPdf = (url.searchParams.get("format") ?? "").toLowerCase() === "pdf";

  if (!asPdf) {
    const i = Number.isInteger(wanted) && wanted >= 1 && wanted <= 6 ? wanted - 1 : 0;
    return new ImageResponse(build[i](ctx), { width: W, height: PH, fonts });
  }

  // Rendered one at a time rather than in parallel: four A4 canvases at once
  // is a lot of resident bitmap for no gain, since Satori is CPU bound.
  const pages: Buffer[] = [];
  for (const make of build) {
    const img = new ImageResponse(make(ctx), { width: W, height: PH, fonts });
    pages.push(Buffer.from(await img.arrayBuffer()));
  }

  const pdf = pngsToPdf(pages, 210, 297, "LinkUpNaija business and financial plan");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="linkupnaija-business-plan.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
