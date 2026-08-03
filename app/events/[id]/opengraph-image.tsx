import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { categoryPhoto } from "@/lib/category-photos";
import { SITE_ORIGIN } from "@/lib/qr";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";

// Rich link preview: every shared event unfurls with its cover art, title,
// date and location — the way an Instagram or WhatsApp link does. Events with
// no uploaded cover fall back to the category photo, so a link is never bare.
export const runtime = "nodejs";
export const alt = "Event on LinkUpNaija";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("events")
    .select("title, category, state, location, date, price, cover_image_url")
    .eq("id", params.id)
    .single();

  const title = (data?.title as string) ?? "LinkUpNaija";
  const category = (data?.category as string) ?? "Party";
  const state = (data?.state as string) ?? "";
  const location = (data?.location as string) ?? "";
  const price = (data?.price as number) ?? 0;
  const cover =
    (data?.cover_image_url as string | null) ??
    `${SITE_ORIGIN}${categoryPhoto(category)}`;

  const when = data?.date
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "long",
      })
    : "";

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
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "1200px",
            height: "630px",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(to top, rgba(11,9,24,0.96) 22%, rgba(11,9,24,0.55) 58%, rgba(11,9,24,0.25) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "56px 60px",
            width: "100%",
          }}
        >
          {/* Brand + category */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_MARK_DATA_URI}
              alt=""
              width={40}
              height={40}
              style={{ width: 40, height: 40 }}
            />
            <div
              style={{
                display: "flex",
                gap: 0,
                letterSpacing: "-0.02em",
                fontSize: 26,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              Link<span style={{ color: "#7F77DD" }}>Up</span>Naija
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: 10,
                padding: "6px 16px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.16)",
                fontSize: 20,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {category}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: title.length > 46 ? 62 : 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#fff",
            }}
          >
            {title.length > 88 ? `${title.slice(0, 88)}…` : title}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 20,
              gap: 26,
              fontSize: 28,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {when && <div style={{ display: "flex" }}>{when}</div>}
            {(location || state) && (
              <div style={{ display: "flex" }}>
                {[location, state].filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{ display: "flex", color: "#FAC775", fontWeight: 800 }}>
              {price > 0 ? `₦${price.toLocaleString("en-NG")}` : "Free"}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );

  // Same reason as the Instagram card — see that route.
  res.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
