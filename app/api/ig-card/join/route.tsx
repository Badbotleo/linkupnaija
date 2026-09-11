import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * The growth card: one sentence, at a size you cannot scroll past.
 *
 * The other cards in here are made of somebody's event or somebody's
 * photograph. This one has no artwork to lean on, which is the whole design
 * problem: a post with nothing to show has to be worth reading, so the
 * typography IS the image and everything else gets out of its way.
 *
 * SIX HOOKS, not one. A campaign is a fortnight of posts and the same card
 * six times is how an account teaches people to scroll past it. Each one
 * argues a different true thing rather than restating the same claim in new
 * words, because the second post has to earn its place against the first.
 *
 * ?v=0..5 picks one. ?v= anything else rotates by the day, so a scheduler
 * that just hits this URL never posts the same card twice running.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;

const HOOKS: { top: string; line: string; under: string }[] = [
  {
    top: "THE PROBLEM",
    line: "Your weekend is in a WhatsApp group you are not in.",
    under: "Every good link-up in Nigeria is already happening. Somewhere you cannot see.",
  },
  {
    top: "HOW IT WORKS",
    line: "Ask to join. The host decides.",
    under: "Not a public party. Somebody looks at your profile and says yes.",
  },
  {
    top: "FOR THE ONE WHO ALWAYS ORGANISES",
    line: "You are the group chat's unpaid event planner.",
    under: "Post it once. Tickets, reminders and the guest list handle themselves.",
  },
  {
    top: "NEW IN TOWN",
    line: "You moved to Lagos and you know four people.",
    under: "Three of them are from work. Find the rest.",
  },
  {
    top: "WHAT IS ON",
    line: "Something is happening tonight within 5km of you.",
    under: "Brunches, game nights, pool parties, bonfires. Open the app and look.",
  },
  {
    top: "BRING SOMEBODY",
    line: "Going alone is the reason you did not go.",
    under: "Bring a friend, or turn up and leave with a few.",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("v"));
  // A day-of-year rotation rather than random: two posts scheduled minutes
  // apart should not be able to land on the same card.
  const day = Math.floor(Date.now() / 86_400_000);
  const i =
    Number.isInteger(raw) && raw >= 0 && raw < HOOKS.length
      ? raw
      : day % HOOKS.length;
  const hook = HOOKS[i];
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          backgroundColor: "#0B0918",
          padding: "58px 60px",
        }}
      >
        {/* A single wash of brand purple. Flat #0B0918 across 1080px reads as
            a slide rather than a poster, and this is the cheapest thing that
            gives it a light source.
            
            Pushed most of the way off-canvas on purpose: Satori has no blur,
            so a smaller circle sits there as a hard-edged ball that reads as
            a mistake. Only a shallow arc should be inside the frame. */}
        <div
          style={{
            position: "absolute",
            top: "-560px",
            right: "-380px",
            display: "flex",
            width: "1240px",
            height: "1240px",
            borderRadius: "620px",
            backgroundColor: "#534AB7",
            opacity: 0.38,
          }}
        />

        {/* The flag rule every card in this family wears. */}
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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 18,
            alignSelf: "flex-start",
            padding: "14px 34px 14px 22px",
            borderRadius: 999,
            backgroundColor: "rgba(11,9,24,0.55)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={58} height={58} style={{ width: 58, height: 58 }} />
          <div
            style={{
              display: "flex",
              letterSpacing: "-0.02em",
              fontSize: 38,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Link<span style={{ color: "#7F77DD" }}>Up</span>Naija
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "11px 26px",
              borderRadius: 999,
              backgroundColor: "#FAC775",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#121212",
            }}
          >
            {hook.top}
          </div>

          {/* The whole point of the card. Sized so it still lands as a
              thumbnail in a grid, which is where most people meet it. */}
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: hook.line.length > 46 ? 78 : 92,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "#fff",
            }}
          >
            {hook.line}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              maxWidth: "880px",
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {hook.under}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 40,
              paddingTop: 26,
              borderTop: "2px solid rgba(255,255,255,0.18)",
              fontSize: 30,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            linkupnaija.com
            <span style={{ marginLeft: 16, color: "#7F77DD" }}>
              Find your people
            </span>
          </div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );
}
