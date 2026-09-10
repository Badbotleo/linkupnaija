"use client";

import { useState } from "react";
import Link from "next/link";
import LineIcon from "../ui/LineIcon";
import VenueArt from "./VenueArt";
import ReservationModal from "./ReservationModal";
import ClaimVenue from "./ClaimVenue";

/**
 * The page for a venue we onboarded, as opposed to one passing through from
 * OpenStreetMap.
 *
 * These had no page at all. /venues/[id] resolved an OSM id and nothing else,
 * so every link to an onboarded venue reached "Venue not found" — including,
 * until now, the "See the venue" link on every slide of the venue reel. The
 * detail API validates ^(node|way|relation)-\d+$ and a UUID is a 400.
 *
 * It is also the only place a claim can sensibly start. Somebody who runs a
 * restaurant finds it by looking themselves up, and the question has to be
 * waiting on the page they land on rather than in a menu they never open.
 */

export interface OnboardedVenueData {
  id: string;
  name: string;
  category: string;
  address: string | null;
  state: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  price_range: string | null;
  rating: number | null;
  rating_count: number | null;
  opening_hours: string | null;
  image_url: string | null;
  gallery_urls: string[];
  lat: number | null;
  lng: number | null;
}

export default function OnboardedVenue({
  venue,
  isLoggedIn,
  /** "pending" | "approved" | "rejected" for this viewer, or null. */
  claimStatus,
  /** Somebody else already runs it, so nobody else may claim it. */
  claimedByAnother,
}: {
  venue: OnboardedVenueData;
  isLoggedIn: boolean;
  claimStatus: string | null;
  claimedByAnother: boolean;
}) {
  const [reserving, setReserving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sent, setSent] = useState(false);

  const photos = [venue.image_url, ...venue.gallery_urls].filter(
    (u): u is string => !!u
  );

  return (
    <div>
      {/* --- the pictures, or honest art in place of them --- */}
      <div className="overflow-hidden rounded-3xl">
        {photos.length > 0 ? (
          <div
            className={`grid gap-1 ${
              photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {photos.slice(0, 5).map((src, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={src}
                src={src}
                alt=""
                className={`w-full object-cover ${
                  photos.length === 1
                    ? "aspect-[16/10]"
                    : i === 0
                      ? "col-span-2 aspect-[16/9]"
                      : "aspect-square"
                }`}
              />
            ))}
          </div>
        ) : (
          <VenueArt
            name={venue.name}
            category={venue.category}
            className="aspect-[16/10] w-full"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
          {venue.category}
        </span>
        {venue.state && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
            {venue.state}
          </span>
        )}
        {venue.rating !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            <LineIcon name="star" size={12} filled />
            {venue.rating.toFixed(1)}
            {!!venue.rating_count && (
              <span className="font-medium text-amber-600/70">
                ({venue.rating_count})
              </span>
            )}
          </span>
        )}
      </div>

      <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900">
        {venue.name}
      </h1>

      {venue.address && (
        <p className="mt-1.5 flex items-start gap-2 text-[15px] text-gray-600">
          <LineIcon name="pin" size={16} className="mt-0.5 shrink-0 text-gray-400" />
          {venue.address}
        </p>
      )}

      {venue.description && (
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">
          {venue.description}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {venue.opening_hours && (
          <Row icon="clock" label="Hours" value={venue.opening_hours} />
        )}
        {venue.price_range && (
          <Row icon="ticket" label="Prices" value={venue.price_range} />
        )}
        {venue.phone && (
          <Row icon="phone" label="Phone" value={venue.phone} href={`tel:${venue.phone}`} />
        )}
        {venue.website && (
          <Row icon="link" label="Website" value={venue.website} href={venue.website} />
        )}
      </dl>

      <button
        type="button"
        onClick={() => setReserving(true)}
        className="btn-primary mt-6 w-full"
      >
        Request a reservation
      </button>

      {/* --- whose place is this --- */}
      {/* Last on the page on purpose. It is addressed to one person in a
          thousand, and putting it above the thing everybody came for would
          be optimising the page for its rarest visitor. */}
      <div className="mt-8 rounded-2xl border border-dashed border-gray-200 p-4">
        {sent || claimStatus === "pending" ? (
          <p className="text-[14px] text-gray-600">
            <span className="font-bold text-gray-900">Claim sent.</span> We
            check these by hand, so give us a day or so. You will get a message
            when it is approved.
          </p>
        ) : claimStatus === "approved" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] font-bold text-gray-900">
              You run this place.
            </p>
            <Link href={`/venues/${venue.id}/manage`} className="btn-primary">
              Manage it
            </Link>
          </div>
        ) : claimedByAnother ? (
          <p className="text-[14px] text-gray-500">
            This venue is managed by its owner. Something wrong with the
            listing?{" "}
            <Link href="/messages" className="font-bold text-brand underline">
              Tell us
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900">
                Do you run {venue.name}?
              </p>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Claim it and put your own photos and details on this page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClaiming(true)}
              className="shrink-0 rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 transition hover:border-brand hover:text-brand"
            >
              Claim it
            </button>
          </div>
        )}
      </div>

      {reserving && (
        <ReservationModal
          venue={{
            // ReservationModal speaks the OSM venue shape. A prefix keeps an
            // onboarded venue's UUID from being mistaken for an OSM id
            // anywhere downstream, which is the confusion that made this page
            // necessary in the first place.
            id: `partner-${venue.id}`,
            name: venue.name,
            address: venue.address ?? "",
            lat: venue.lat ?? 0,
            lng: venue.lng ?? 0,
          }}
          isLoggedIn={isLoggedIn}
          onClose={() => setReserving(false)}
        />
      )}

      {claiming && (
        <ClaimVenue
          venueId={venue.id}
          venueName={venue.name}
          isLoggedIn={isLoggedIn}
          onClose={() => setClaiming(false)}
          onSent={() => {
            setSent(true);
            setClaiming(false);
          }}
        />
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-gray-400">
        {label}
      </span>
      <span className="block truncate text-[14px] font-semibold text-gray-800">
        {value}
      </span>
    </span>
  );
  const inner = (
    <span className="flex items-start gap-2.5 rounded-xl border border-gray-100 p-3">
      <LineIcon name={icon} size={15} className="mt-1 shrink-0 text-gray-400" />
      {body}
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  );
}
