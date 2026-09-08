import { ImageResponse } from "next/og";
import { buildIdeas } from "@/lib/things-to-do";
import { SITE_ORIGIN } from "@/lib/qr";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import { ogImageSrc } from "@/lib/og-image-src";

/**
 * "5 places to link up this week", as one 1080x1080 Instagram post.
 *
 * The per-event card is one post per event, which is fine for a flyer and
 * tedious for a weekly round-up. This is the other shape: the Things to do
 * list the app already builds, drawn as a numbered list on the first idea's
 * artwork.
 *
 * It is the most repeatable post the account has, because it is useful to
 * somebody who never downloads anything, and because the data is generated
 * whether or not anybody posts it.
 *
 * ?state=Lagos narrows it to a city. ?n=5 sets how many rows.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const n = Math.min(6, Math.max(3, Number(url.searchParams.get("n")) || 5));

  const all = await buildIdeas(state, { limit: 30, perActivityCap: 1 });

  // A list is only worth reading if the rows name somewhere.
  //
  // Ideas whose artwork carries its own wording have hideLabel set, their
  // title falls back to the category and their place is blank. That is right
  // in the app, where the photograph fills the screen and says the rest. On a
  // text list it produces "Brunch" with nothing underneath it, five times.
  // Those are used only if there is nothing better.
  const named = all.filter((i) => !i.hideLabel && i.place.trim());
  const rest = all.filter((i) => i.hideLabel || !i.place.trim());

  const seen = new Set<string>();
  const ideas = [...named, ...rest]
    .filter((i) => {
      const k = `${i.title}|${i.place}`.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);

  if (ideas.length === 0) {
    return new Response("No ideas to draw yet", { status: 404 });
  }

  // The first PICTURE, not the first idea. Curated ideas can be video, and a
  // video URL in an <img> renders as nothing at all, which is what left this
  // card on a flat background.
  //
  // Satori also cannot decode WebP: it fails silently and leaves a black
  // rectangle. ogImageSrc routes Supabase media through the transcoder, which
  // returns JPEG whatever was uploaded.
  const heroIdea =
    ideas.find((i) => i.mediaType === "image") ??
    all.find((i) => i.mediaType === "image");
  const hero =
    (heroIdea ? ogImageSrc(heroIdea.image) : null) ??
    `${SITE_ORIGIN}/venues/restaurants.jpg`;

  const where = state ? state.replace("FCT - ", "") : "Nigeria";
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#0B0918",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          width={SIZE}
          height={SIZE}
          style={{
            position: "absolute",
            inset: 0,
            width: `${SIZE}px`,
            height: `${SIZE}px`,
            objectFit: "cover",
          }}
        />
        {/* Heavier than the event card's scrim on purpose. That one protects
            two lines over a flyer; this one carries six rows of text, and a
            list is unreadable over a busy photograph. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: `${SIZE}px`,
            height: `${SIZE}px`,
            backgroundImage:
              "linear-gradient(to top, rgba(11,9,24,0.97) 55%, rgba(11,9,24,0.9) 74%, rgba(11,9,24,0.62) 90%, rgba(11,9,24,0.4) 100%)",
          }}
        />

        {/* Nigerian flag rule, the same one the event card wears. */}
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
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "58px 60px 58px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              alignSelf: "flex-start",
              padding: "14px 34px 14px 22px",
              borderRadius: 999,
              backgroundColor: "rgba(11,9,24,0.62)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={58} height={58} style={{ width: 58, height: 58 }} />
            <div
              style={{
                display: "flex",
                gap: 0,
                letterSpacing: "-0.02em",
                fontSize: 38,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              Link<span style={{ color: "#7F77DD" }}>Up</span>Naija
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "12px 28px",
                borderRadius: 999,
                backgroundColor: "#FAC775",
                fontSize: 28,
                fontWeight: 800,
                color: "#121212",
              }}
            >
              THIS WEEK
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                color: "#fff",
              }}
            >
              {ideas.length} places to link up in {where}
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
              {ideas.map((idea, i) => (
                <div
                  key={idea.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    paddingTop: 13,
                    paddingBottom: 13,
                    borderTop: i === 0 ? "none" : "2px solid rgba(255,255,255,0.14)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 56,
                      fontSize: 34,
                      fontWeight: 800,
                      color: "#7F77DD",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 37,
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {idea.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        marginTop: 4,
                        fontSize: 25,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.68)",
                      }}
                    >
                      {idea.place}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 28,
                paddingTop: 22,
                borderTop: "2px solid rgba(255,255,255,0.22)",
                fontSize: 28,
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              Pick one, bring your people  ·  linkupnaija.com
            </div>
          </div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );
}
