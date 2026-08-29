import { SITE_ORIGIN } from "./qr";

/**
 * JSON-LD for search engines. The site had none at all.
 *
 * For a listings site this is the difference between a blue link and a result
 * that shows the date, the place and the price in Google itself — and it is
 * what makes an event eligible for the events carousel, which is precisely
 * where "things to do in Lagos this weekend" lands. Organic search sent us
 * fewer than a hundred sessions last month against TikTok's eleven hundred;
 * this is the cheapest lever left untouched.
 *
 * Everything is built from real columns. A schema that claims a price or a
 * venue the page does not show is a structured-data violation, not a clever
 * trick, and Google drops the whole rich result for the domain when it finds
 * one.
 */

/** Nigeria is UTC+1 all year. No DST, so a fixed offset is correct here. */
const WAT = "+01:00";

/**
 * Google requires an ISO 8601 startDate and treats a bare date as midnight,
 * which would advertise every evening party as a 12am event.
 */
function isoDateTime(date: string, time: string | null): string {
  if (!date) return "";
  if (!time) return date;
  // Postgres time comes back as HH:MM:SS; ISO 8601 wants HH:MM:SS with offset.
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hhmmss}${WAT}`;
}

export interface EventForSchema {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  end_time?: string | null;
  location: string | null;
  state: string | null;
  price: number | null;
  cover_image_url: string | null;
  host?: { id?: string; name: string | null } | null;
}

export function eventJsonLd(e: EventForSchema) {
  const url = `${SITE_ORIGIN}/events/${e.id}`;
  const start = isoDateTime(e.date, e.time);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: start,
    // Physical rooms are the whole product. Nothing here is a webinar.
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url,
    location: {
      "@type": "Place",
      name: e.location || e.state || "Nigeria",
      address: {
        "@type": "PostalAddress",
        // streetAddress is what the host typed; the rest is all we reliably
        // know. Inventing a postcode to fill the shape would be worse than
        // omitting it.
        streetAddress: e.location || undefined,
        addressRegion: e.state || undefined,
        addressCountry: "NG",
      },
    },
  };

  if (e.end_time) schema.endDate = isoDateTime(e.date, e.end_time);
  if (e.description) schema.description = e.description.slice(0, 500);
  if (e.cover_image_url) schema.image = [e.cover_image_url];

  if (e.host?.name) {
    schema.organizer = {
      "@type": "Person",
      name: e.host.name,
      ...(e.host.id ? { url: `${SITE_ORIGIN}/u/${e.host.id}` } : {}),
    };
  }

  // Free events still carry an offer. Omitting it loses the "Free" label that
  // Google renders in the result, which on this platform is about half the
  // catalogue and a real reason to click.
  schema.offers = {
    "@type": "Offer",
    url,
    price: e.price ?? 0,
    priceCurrency: "NGN",
    availability: "https://schema.org/InStock",
    validFrom: new Date().toISOString().slice(0, 10),
  };

  return schema;
}

/** Who the site is. Renders once, in the layout. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LinkUpNaija",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/icon-512.png`,
    description:
      "Find link-ups near you across Nigeria. The host approves every guest.",
    areaServed: { "@type": "Country", name: "Nigeria" },
    sameAs: [
      "https://www.instagram.com/linkupnaija",
      "https://www.tiktok.com/@linkupnaija",
    ],
  };
}

/**
 * Declares the site search so Google can offer a search box under the brand
 * result. Points at the real /events query parameter, because a sitelinks
 * search box that 404s is worse than none.
 */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LinkUpNaija",
    url: SITE_ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/events?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * One script tag, escaped.
 *
 * JSON.stringify does not escape "<", so a host who types "</script>" into a
 * description would close the tag and inject markup. Rare, and trivially
 * exploitable if left.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
