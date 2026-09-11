import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import { artPalette, artInitials } from "@/lib/generated-art";

/**
 * "Is this your place?" — one card per venue that has no photograph.
 *
 * 223 of 257 onboarded venues have no picture of the actual place, because
 * the importer will not copy Google's and we have not been there. That is a
 * problem and it is also the campaign: every one of those venues is a post
 * addressed to exactly one person, and that person recognises their own
 * business name in a way no generic graphic can compete with.
 *
 * No ?venue and it picks one at random from the venues that need it, so the
 * URL can just be hit again for the next post. ?venue=<uuid> pins it.
 *
 * WHY IT SHOWS THE PLACEHOLDER. There is by definition no photograph to use,
 * and a stock image standing in for a real place is the exact thing this
 * campaign exists to fix. So the card shows what their listing ACTUALLY looks
 * like right now: the same hashed gradient and monogram lib/generated-art
 * draws on the live page, at the top, labelled. The argument stops being a
 * claim and becomes a demonstration, and the owner recognises the problem
 * before reading a word of the pitch.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("venue");
  const supabase = createClient();

  interface Row {
    id: string;
    name: string;
    category: string;
    state: string | null;
  }
  let venue: Row | null = null;

  if (id) {
    const { data } = await supabase
      .from("venues")
      .select("id, name, category, state")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    venue = data as Row | null;
  } else {
    // The ones this campaign is for: onboarded, live, and still wearing
    // generated art because nobody has sent us a photograph.
    const { data } = await supabase
      .from("venues")
      .select("id, name, category, state")
      .eq("is_active", true)
      .is("image_url", null)
      .limit(60);
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length) venue = rows[Math.floor(Math.random() * rows.length)];
  }

  if (!venue) {
    return new Response("No venue to draw", { status: 404 });
  }

  const fonts = await ogFonts();
  const long = venue.name.length > 22;
  // The very same seed the live tile uses, so this is their listing rather
  // than an impression of it.
  const [dark, mid, light] = artPalette(venue.name);
  const mono = artInitials(venue.name);

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
          backgroundColor: "#221E49",
          padding: "58px 60px",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: "-520px",
            left: "-340px",
            display: "flex",
            width: "1180px",
            height: "1180px",
            borderRadius: "590px",
            backgroundColor: "#534AB7",
            opacity: 0.38,
          }}
        />

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

        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            alignSelf: "flex-start",
            padding: "14px 34px 14px 22px",
            borderRadius: 999,
            backgroundColor: "rgba(11,9,24,0.42)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK_DATA_URI} alt="" width={54} height={54} style={{ width: 54, height: 54 }} />
          <div
            style={{
              display: "flex",
              letterSpacing: "-0.02em",
              fontSize: 34,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Link<span style={{ color: "#8B83E6" }}>Up</span>Naija
          </div>
        </div>

        {/* Their listing as it stands. Same palette, same monogram, same
            rounded tile the venues page renders. */}
        <div style={{ display: "flex", marginTop: 34, alignItems: "flex-end", gap: 22 }}>
          <div
            style={{
              display: "flex",
              width: "300px",
              height: "230px",
              borderRadius: 26,
              backgroundColor: dark,
              backgroundImage: `linear-gradient(135deg, ${dark} 0%, ${mid} 62%, ${light} 140%)`,
              alignItems: "flex-end",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {mono}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 6 }}>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#FAC775",
              }}
            >
              YOUR PAGE RIGHT NOW
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                maxWidth: "400px",
                fontSize: 27,
                fontWeight: 400,
                lineHeight: 1.3,
                color: "rgba(255,255,255,0.62)",
              }}
            >
              We draw this because we do not have a photo of the place.
            </div>
          </div>
        </div>
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 400,
              color: "rgba(255,255,255,0.66)",
            }}
          >
            Already listed on LinkUpNaija
          </div>

          {/* The name, and nothing competing with it. */}
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: long ? 82 : 104,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.0,
              color: "#fff",
            }}
          >
            {venue.name}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.14)",
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {venue.category}
            </div>
            {venue.state && (
              <div
                style={{
                  display: "flex",
                  padding: "10px 24px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {venue.state.replace("FCT - ", "")}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              padding: "30px 34px",
              borderRadius: 28,
              backgroundColor: "#FAC775",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 46,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "#121212",
              }}
            >
              Is this your place?
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 29,
                fontWeight: 400,
                lineHeight: 1.3,
                color: "rgba(18,18,18,0.78)",
              }}
            >
              Claim it and put your own photos, hours and prices on the page.
              Free.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 30,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            linkupnaija.com/venues
          </div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );
}
