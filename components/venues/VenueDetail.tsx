"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { fetchVenueById, VENUE_CATEGORIES, type Venue } from "@/lib/overpass";
import ReservationModal from "./ReservationModal";

const VenuesMap = dynamic(() => import("./VenuesMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[360px] place-items-center rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

export default function VenueDetail({
  id,
  isLoggedIn,
}: {
  id: string;
  isLoggedIn: boolean;
}) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchVenueById(id)
      .then((v) => {
        if (active) {
          setVenue(v);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-gray-400">
        Loading venue…
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
        <p className="text-4xl">🤔</p>
        <h2 className="mt-3 text-lg font-bold text-gray-900">
          Venue not found
        </h2>
        <Link href="/venues" className="btn-primary mt-6">
          Back to venues
        </Link>
      </div>
    );
  }

  const cat = VENUE_CATEGORIES.find((c) => c.key === venue.category);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
          {cat?.emoji} {venue.category}
        </span>
        {venue.stars ? (
          <span className="text-sm font-semibold text-amber-500">
            {"★".repeat(Math.min(5, Math.round(venue.stars)))}
          </span>
        ) : null}
      </div>

      <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
        {venue.name}
      </h1>
      {venue.address && (
        <p className="mt-1 text-gray-600">📍 {venue.address}</p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VenuesMap
            center={{ lat: venue.lat, lng: venue.lng }}
            venues={[venue]}
            zoom={15}
          />
        </div>

        <aside>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            <dl className="space-y-3 text-sm">
              {venue.openingHours && (
                <div>
                  <dt className="font-semibold text-gray-900">Opening hours</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-gray-600">
                    {venue.openingHours}
                  </dd>
                </div>
              )}
              {venue.phone && (
                <div>
                  <dt className="font-semibold text-gray-900">Phone</dt>
                  <dd className="mt-0.5 text-gray-600">{venue.phone}</dd>
                </div>
              )}
              {venue.website && (
                <div>
                  <dt className="font-semibold text-gray-900">Website</dt>
                  <dd className="mt-0.5 truncate">
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      {venue.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-primary mt-5 w-full"
            >
              Request Reservation
            </button>
          </div>

          <Link
            href="/venues"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-brand"
          >
            ← Back to venues
          </Link>
        </aside>
      </div>

      {open && (
        <ReservationModal
          venue={venue}
          isLoggedIn={isLoggedIn}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
