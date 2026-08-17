import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "@/lib/qr";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";
import { ogFonts } from "@/lib/og-fonts";
import {
  BRAND,
  CROPS,
  buildCaption,
  cleanTitle,
  formatWhen,
  gradientFor,
  priceLabel,
  urgencyFor,
  type CardEvent,
  type Crop,
} from "@/lib/ig-card";

/**
 * The event graphic, in three crops from one layout.
 *
 * ?size=feed (1080×1080) · portrait (1080×1350) · story (1080×1920)
 * ?caption=1 returns the caption text instead of the image.
 *
 * The layout change that matters: the cover is a BAND across the top, not a
 * backdrop behind the text. Hosts upload posters that already carry the
 * title, date and venue burned in, and the old card printed all three on top
 * of them — a poster stamped over a poster, unreadable at feed size and
 * actively bad as an ad. Showing the poster intact and putting our
 * information on solid brand ground below means both halves are legible, and
 * the block underneath is a consistent, scannable shape across every event,
 * which is what makes a set of these read as one campaign.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const size = (url.searchParams.get("size") ?? "feed") as Crop;
  const crop = CROPS[size] ?? CROPS.feed;
  const wantsCaption = url.searchParams.get("caption") === "1";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("events")
    .select(
      "id, title, category, state, location, date, time, price, description, cover_image_url, max_attendees"
    )
    .eq("id", params.id)
    .single();

  if (!data) return new Response("Event not found", { status: 404 });
  const event = data as unknown as CardEvent;

  // Never advertise something nobody can attend. A past event in a paid ad
  // burns budget and trust at the same time.
  const today = new Date().toISOString().slice(0, 10);
  if (event.date < today) {
    return new Response("Event has passed — no graphic generated", {
      status: 409,
    });
  }

  // Accepted RSVPs only: pending requests aren't attendance, and counting
  // them would inflate every number on the card.
  const { count } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "accepted");
  const going = count ?? 0;

  const eventUrl = `${SITE_ORIGIN}/events/${event.id}`;

  if (wantsCaption) {
    return new Response(buildCaption(event, going, eventUrl), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=300",
      },
    });
  }

  const title = cleanTitle(event.title) || "LinkUpNaija";
  const when = formatWhen(event.date, event.time);
  const urgency = urgencyFor(going, event.max_attendees);
  const [g1, g2] = gradientFor(event.category);
  const isFree = (event.price ?? 0) <= 0;

  // Proportions per crop. The cover is ~45% on feed and portrait; on story it
  // takes less, because the safe zones at both ends squeeze the middle.
  const coverH = size === "story" ? crop.h * 0.38 : crop.h * 0.45;
  // Instagram's link sticker sits in the bottom ~200px of a story. The CTA
  // clears it rather than being covered by it.
  const bottomPad = size === "story" ? 260 : 64;

  // Long titles have to shrink or they run out of card.
  const titleSize = title.length > 62 ? 62 : title.length > 38 ? 74 : 88;

  // Then hard-truncate to what two lines can actually hold. Satori's lineClamp
  // is ignored inside a flex container, which sliced long titles through the
  // middle of the second line — legible enough to look broken rather than
  // trimmed. Budget is derived from the panel's usable width (crop − padding)
  // at roughly 0.52em per character for this face, times two lines.
  const perLine = Math.floor((crop.w - 128) / (titleSize * 0.68));
  const budget = perLine * 2 - 2;
  const displayTitle =
    title.length > budget ? `${title.slice(0, budget).trimEnd()}…` : title;

  const fonts = await ogFonts();

  const res = new ImageResponse(
    (
      <div
        style={{
          width: crop.w,
          height: crop.h,
          display: "flex",
          flexDirection: "column",
          background: BRAND.bg,
          fontFamily: "Noto Sans",
        }}
      >
        {/* ---------------------------------------------------- cover band */}
        <div
          style={{
            position: "relative",
            width: crop.w,
            height: coverH,
            display: "flex",
            // The gradient is the fallback AND the backing for a cover that
            // doesn't fill the frame, so a portrait poster never sits on
            // bare black.
            backgroundImage: `linear-gradient(135deg, ${g1}, ${g2})`,
          }}
        >
          {event.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt=""
              width={crop.w}
              height={coverH}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {/* Just enough scrim at the seam that the band reads as joined to
              the panel rather than pasted above it. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(to bottom, rgba(15,10,46,0.35) 0%, rgba(15,10,46,0) 22%, rgba(15,10,46,0) 72%, ${BRAND.bg} 100%)`,
            }}
          />

          {/* Logo, small, top right */}
          <div
            style={{
              position: "absolute",
              top: 34,
              right: 34,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px 10px 12px",
              borderRadius: 999,
              background: "rgba(15,10,46,0.62)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_MARK_DATA_URI} alt="" width={30} height={30} />
            <span style={{ fontSize: 24, fontWeight: 700, color: BRAND.white }}>
              LinkUpNaija
            </span>
          </div>
        </div>

        {/* --------------------------------------------------------- panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: `44px 64px ${bottomPad}px 64px`,
          }}
        >
          {/* Category + city. The eyebrow answers "is this for me?" before
              anyone reads the title. */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 4,
              color: BRAND.purpleLight,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {event.category}
            {event.state ? ` in ${event.state}` : ""}
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2,
              color: BRAND.white,
              display: "flex",
              // A fixed two-line box. The character budget above should keep
              // the text inside it, but a budget is an estimate and this is
              // not: whatever the estimate gets wrong is clipped rather than
              // allowed to overlap the date underneath.
              height: Math.round(titleSize * 1.32 * 2),
              overflow: "hidden",
            }}
          >
            {displayTitle}
          </div>

          {/* When and where, on their own line so both survive a glance. */}
          <div
            style={{
              marginTop: 26,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 34, fontWeight: 700, color: BRAND.white }}>
              {when}
            </span>
            {event.location && (
              <span
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.7)",
                  display: "flex",
                }}
              >
                {event.location.length > 52
                  ? `${event.location.slice(0, 52).trimEnd()}…`
                  : event.location}
              </span>
            )}
          </div>

          {/* Price and scarcity. Free is a selling point, so it gets the
              green badge rather than a grey line of text. */}
          <div style={{ marginTop: 30, display: "flex", gap: 14 }}>
            <span
              style={{
                display: "flex",
                padding: "12px 26px",
                borderRadius: 999,
                fontSize: 30,
                fontWeight: 700,
                background: isFree ? BRAND.green : BRAND.gold,
                color: "#12121A",
              }}
            >
              {priceLabel(event.price ?? 0)}
            </span>
            {urgency && (
              <span
                style={{
                  display: "flex",
                  padding: "12px 26px",
                  borderRadius: 999,
                  fontSize: 30,
                  fontWeight: 700,
                  background:
                    urgency.tone === "urgent" ? BRAND.coral : "rgba(255,255,255,0.12)",
                  color: urgency.tone === "urgent" ? "#231014" : BRAND.white,
                }}
              >
                {urgency.label}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* CTA bar. Gold, full width, the last thing read. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "26px 34px",
              borderRadius: 26,
              background: BRAND.gold,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 700, color: "#1A1040" }}>
              Request to join
            </span>
            <span
              style={{
                marginTop: 4,
                fontSize: 26,
                color: "#3C3489",
                display: "flex",
              }}
            >
              linkupnaija.com
            </span>
          </div>
        </div>
      </div>
    ),
    { width: crop.w, height: crop.h, fonts }
  );

  // Keyed on the fields that appear on the image, so a description edit
  // doesn't invalidate a card it never touched — and a title change does.
  const stamp = [
    event.title,
    event.category,
    event.state,
    event.location,
    event.date,
    event.time,
    event.price,
    event.cover_image_url,
    event.max_attendees,
    going,
    size,
  ].join("|");
  const etag = `W/"${Buffer.from(stamp).toString("base64url").slice(0, 32)}"`;

  res.headers.set("ETag", etag);
  res.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
  );
  return res;
}
