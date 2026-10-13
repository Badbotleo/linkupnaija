/**
 * Reviews for our venues, borrowed from Google until we have our own.
 *
 * venue_reviews is empty: RateVenuePrompt asks for a rating only after a
 * confirmed reservation at a partner venue on a date that has passed, which
 * is the right gate and also means the table stays empty until the booking
 * side of the business works. A venue page with no opinion on it is a venue
 * page nobody trusts, so this fills the gap with the opinions that already
 * exist.
 *
 * WHAT GOOGLE'S TERMS ALLOW, BECAUSE IT DICTATES THE SHAPE OF THIS FILE.
 *
 * 1. place_id is explicitly exempt from the caching restrictions and may be
 *    stored indefinitely. So we store it, once, per venue.
 * 2. Everything else, ratings and reviews included, has NO caching
 *    exception. They may not be pre-fetched, cached or stored. So they are
 *    fetched when a venue page is rendered and never written to our
 *    database, and there is deliberately no unstable_cache here. Plugins
 *    that cache Google reviews for 24 hours are common and are out of
 *    compliance; we are not copying them.
 * 3. Attributions are mandatory. The author's name, photo and the link to
 *    their review have to be shown, which GoogleReviews does.
 *
 * WHICH MEANS IT COSTS MONEY PER PAGE VIEW. Reviews come back in the
 * Enterprise + Atmosphere field set, billed at $25 per 1,000 calls with
 * 1,000 free a month, and with no caching allowed that is one billable call
 * per venue page view. That is why nothing here is called from the venue
 * LIST: 304 cards on one screen would be 304 calls. Resolving the place_id
 * uses the Essentials field set instead, which is far cheaper, and happens
 * once per venue ever.
 *
 * Absent a key, every function here returns null and the venue page renders
 * exactly as it does today. The integration is dormant, not broken, until
 * GOOGLE_PLACES_API_KEY is set.
 */

const BASE = "https://places.googleapis.com/v1";

export interface GoogleReview {
  name: string;
  text: string | null;
  rating: number;
  relativeTime: string | null;
  authorName: string | null;
  authorPhoto: string | null;
  authorUri: string | null;
}

export interface GooglePlaceReviews {
  rating: number | null;
  total: number | null;
  reviews: GoogleReview[];
  /** Google requires a way through to the place itself. */
  mapsUri: string | null;
}

function key(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || null;
}

/**
 * Find a venue on Google, once.
 *
 * Text search rather than nearby search: we have a name and an address and
 * no reliable coordinates for most rows. The field mask asks for ids only,
 * which Google bills at nothing.
 *
 * The caller stores the result on the venue row. This is not meant to run on
 * a page render.
 */
export async function resolvePlaceId(
  name: string,
  address: string | null,
  state: string | null
): Promise<string | null> {
  const k = key();
  if (!k) return null;

  // Nigeria explicitly: "Bheerhugz Cafe, Ikeja" matches things in several
  // countries, and a venue page quoting reviews of a different continent's
  // restaurant is worse than a venue page quoting none.
  const query = [name, address, state, "Nigeria"].filter(Boolean).join(", ");

  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": k,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        textQuery: query,
        regionCode: "NG",
        maxResultCount: 1,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { places?: { id?: string }[] };
    return json.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The ratings and reviews for a place, fresh.
 *
 * Never cached, never stored: see the note at the top. Returns null on any
 * failure, because a venue page that works without Google must keep working
 * when Google is slow, rate-limited or out of quota.
 */
export async function getPlaceReviews(
  placeId: string
): Promise<GooglePlaceReviews | null> {
  const k = key();
  if (!k || !placeId) return null;

  try {
    const res = await fetch(
      `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": k,
          "X-Goog-FieldMask":
            "rating,userRatingCount,googleMapsUri,reviews",
        },
        // Six seconds. A venue page must not sit on a third party.
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      reviews?: {
        name?: string;
        rating?: number;
        relativePublishTimeDescription?: string;
        text?: { text?: string };
        originalText?: { text?: string };
        authorAttribution?: {
          displayName?: string;
          photoUri?: string;
          uri?: string;
        };
      }[];
    };

    const reviews: GoogleReview[] = (json.reviews ?? [])
      .map((r) => ({
        name: r.name ?? "",
        // Google's terms say a review is shown as written. Truncating it in
        // the API layer would make that impossible to honour later, so the
        // full text travels and the component decides how to present it.
        text: r.text?.text ?? r.originalText?.text ?? null,
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? null,
        authorName: r.authorAttribution?.displayName ?? null,
        authorPhoto: r.authorAttribution?.photoUri ?? null,
        authorUri: r.authorAttribution?.uri ?? null,
      }))
      .filter((r) => !!r.text);

    if (!json.rating && reviews.length === 0) return null;

    return {
      rating: json.rating ?? null,
      total: json.userRatingCount ?? null,
      reviews,
      mapsUri: json.googleMapsUri ?? null,
    };
  } catch {
    return null;
  }
}
