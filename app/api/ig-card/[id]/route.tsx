import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { categoryPhoto } from "@/lib/category-photos";
import { SITE_ORIGIN } from "@/lib/qr";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

/**
 * A 1080×1080 Instagram post for an event: the event's own cover art under
 * LinkUpNaija branding.
 *
 * Separate from opengraph-image.tsx because that one is 1200×630 for link
 * unfurls — Instagram crops that to ribbons. This is the square you actually
 * post, sized to Instagram's native feed dimensions.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("events")
    .select("title, category, state, location, date, time, price, cover_image_url")
    .eq("id", params.id)
    .single();

  if (!data) {
    return new Response("Event not found", { status: 404 });
  }

  // Titles here start with an emoji and Satori ships no emoji font, so one
  // renders as a grey blob. Strip leading pictographs from the graphic only.
  // Written with explicit surrogate ranges because tsconfig targets ES5,
  // where \p{...} unicode property escapes aren't available.
  const title = ((data.title as string) ?? "LinkUpNaija")
    .replace(
      /^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u2BFF\uFE0F\u200D\s])+/,
      ""
    )
    .trim();
  const category = (data.category as string) ?? "Party";
  const state = (data.state as string) ?? "";
  const location = (data.location as string) ?? "";
  const price = (data.price as number) ?? 0;
  const cover =
    (data.cover_image_url as string | null) ??
    `${SITE_ORIGIN}${categoryPhoto(category)}`;

  const when = data.date
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  // Long titles have to shrink or they blow past the canvas.
  const titleSize = title.length > 60 ? 54 : title.length > 34 ? 66 : 82;

  const fonts = await ogFonts();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#1A1040",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
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
        {/* Scrim. Satori needs backgroundImage and real dimensions here —
            `background` + `inset:0` alone renders nothing, which left the
            copy sitting unreadable on top of busy flyer art. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: `${SIZE}px`,
            height: `${SIZE}px`,
            backgroundImage:
              "linear-gradient(to top, rgba(11,9,24,0.97) 34%, rgba(11,9,24,0.75) 55%, rgba(11,9,24,0.45) 78%, rgba(11,9,24,0.55) 100%)",
          }}
        />

        {/* Nigerian flag rule across the very top */}
        <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: `${SIZE}px` }}>
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
            padding: "70px 68px 78px",
            width: "100%",
          }}
        >
          {/* Brand lockup, top */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_MARK_DATA_URI}
              alt=""
              width={62}
              height={62}
              style={{ width: 62, height: 62 }}
            />
            <div
              style={{
                display: "flex",
                gap: 0,
                letterSpacing: "-0.02em",
                fontSize: 42,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              Link<span style={{ color: "#7F77DD" }}>Up</span>Naija
            </div>
          </div>

          {/* The event */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  padding: "12px 28px",
                  borderRadius: 999,
                  backgroundColor: "#FAC775",
                  fontSize: 30,
                  fontWeight: 800,
                  color: "#1A1040",
                }}
              >
                {category}
              </div>
              <div
                style={{
                  display: "flex",
                  padding: "12px 28px",
                  borderRadius: 999,
                  backgroundColor: price > 0 ? "rgba(255,255,255,0.18)" : "#008753",
                  fontSize: 30,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {price > 0 ? `₦${price.toLocaleString("en-NG")}` : "Free"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 30,
                fontSize: titleSize,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 34,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {[when, location || state].filter(Boolean).join("  ·  ")}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 42,
                paddingTop: 28,
                borderTop: "2px solid rgba(255,255,255,0.22)",
                fontSize: 28,
                fontWeight: 700,
                color: "#FAC775",
              }}
            >
              Request to join on linkupnaija.com
            </div>
          </div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE, fonts }
  );

  // next/og hardcodes `public, immutable, max-age=31536000`, so a card
  // generated before a logo change is pinned in every browser for a year and
  // never revalidated. Overwrite it: browsers re-check, the CDN holds an hour.
  res.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
