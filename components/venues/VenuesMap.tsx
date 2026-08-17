"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MapTiles from "../map/MapTiles";
import LineIcon from "../ui/LineIcon";
import { MapContainer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VENUE_CATEGORIES, type Venue } from "@/lib/overpass";

/**
 * The tile that stands in for a photo.
 *
 * The list cards pull from a stock pool, which is fine at a glance and wrong
 * up close: two clubs three streets apart get the same interior, and it reads
 * as filler the moment you notice. On a map card — one venue, full attention —
 * that's worse than showing no photo at all.
 *
 * So this is drawn instead: the category's own mark on a tint derived from
 * the venue's name, which means the same venue is always the same colour and
 * two neighbours are reliably different. Nothing is fetched, which also keeps
 * it off the egress bill.
 */
const TINTS = [
  ["#534AB7", "#7C6FE8"], // brand purple
  ["#0F766E", "#14B8A6"], // teal
  ["#B45309", "#F59E0B"], // amber
  ["#9D174D", "#EC4899"], // rose
  ["#1E40AF", "#3B82F6"], // blue
  ["#3F6212", "#84CC16"], // olive
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

const emojiFor = (category: string) =>
  VENUE_CATEGORIES.find((c) => c.key === category)?.emoji ?? "📍";

function VenueMark({ venue }: { venue: Venue }) {
  const [from, to] = tintFor(venue.name);
  return (
    <span
      aria-hidden
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-[22px] shadow-inner"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {emojiFor(venue.category)}
    </span>
  );
}

const pinSvg = (fill: string) =>
  `<svg width="30" height="30" viewBox="0 0 24 24" fill="${fill}" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="white" stroke="none"/></svg>`;

const PIN_SVG = pinSvg("#534AB7");
// Venues we've onboarded get the gold pin, so a partner reads as a partner on
// the map the same way it does in the list.
const PARTNER_PIN_SVG = pinSvg("#FAC775");

export interface PartnerPin {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lng: number;
}

function makeIcon(delayMs: number, ripple: boolean, svg: string = PIN_SVG) {
  const html = ripple
    ? `<div style="position:relative"><span class="pin-ripple-ring"></span>${svg}</div>`
    : `<div class="pin-drop" style="animation-delay:${delayMs}ms">${svg}</div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

function FlyToSelected({ venue }: { venue: Venue | null }) {
  const map = useMap();
  useEffect(() => {
    if (venue) map.flyTo([venue.lat, venue.lng], Math.max(map.getZoom(), 15), {
      duration: 0.7,
    });
  }, [venue, map]);
  return null;
}

export default function VenuesMap({
  center,
  venues,
  partners = [],
  zoom = 13,
  height = "360px",
  showPreview = true,
}: {
  center: { lat: number; lng: number };
  /** OpenStreetMap results, already stripped of anything we've onboarded. */
  venues: Venue[];
  /** Onboarded venues, pinned in gold. */
  partners?: PartnerPin[];
  zoom?: number;
  height?: string;
  showPreview?: boolean;
}) {
  const [selected, setSelected] = useState<Venue | null>(null);
  // Only onboarded venues have a real page. An OSM result routed to
  // /venues/node-123 is a dead end, so the card has to know which it is.
  const [isPartner, setIsPartner] = useState(false);

  // Stable per-marker icons (so selecting one doesn't re-drop the others).
  const baseIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    venues.forEach((v, i) => m.set(v.id, makeIcon(Math.min(i, 16) * 120, false)));
    return m;
  }, [venues]);
  const rippleIcon = useMemo(() => makeIcon(0, true), []);
  const partnerIcon = useMemo(() => makeIcon(0, false, PARTNER_PIN_SVG), []);

  return (
    <div
      className="relative z-0 overflow-hidden rounded-2xl border border-gray-100 shadow-card"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <MapTiles />
        <Recenter lat={center.lat} lng={center.lng} />
        <FlyToSelected venue={selected} />
        {partners.map((p) => (
          <Marker
            key={`partner-${p.id}`}
            position={[p.lat, p.lng]}
            icon={partnerIcon}
            eventHandlers={{
              click: () => {
                setIsPartner(true);
                setSelected({
                  id: p.id,
                  osmType: "node",
                  osmId: 0,
                  name: p.name,
                  category: p.category,
                  lat: p.lat,
                  lng: p.lng,
                  address: p.address ?? "",
                });
              },
            }}
          />
        ))}
        {venues.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={selected?.id === v.id ? rippleIcon : baseIcons.get(v.id)}
            eventHandlers={{
              click: () => {
                setIsPartner(false);
                setSelected(v);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Sliding preview card */}
      {showPreview && selected && (
        <div className="animate-fade-in-up absolute inset-x-3 bottom-3 z-[500] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          {/* Gold rule, matching the gold pin — a partner reads as a partner
              here the same way it does on the map and in the list. */}
          {isPartner && <div className="h-1 w-full bg-[#FAC775]" />}

          <div className="flex items-start gap-3 p-3">
            <VenueMark venue={selected} />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[15px] font-extrabold leading-tight text-gray-900">
                  {selected.name}
                </p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <LineIcon name="x" size={13} />
                </button>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                  {selected.category}
                </span>
                {isPartner && (
                  <span className="rounded-full bg-[#FAC775] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#121212]">
                    Partner
                  </span>
                )}
              </div>

              {selected.address && (
                <p className="mt-1.5 flex items-start gap-1 text-[12px] leading-snug text-gray-500">
                  <LineIcon
                    name="pin"
                    size={12}
                    className="mt-[2px] shrink-0 text-gray-400"
                  />
                  <span className="line-clamp-2">{selected.address}</span>
                </p>
              )}
            </div>
          </div>

          {/* Two doors. Directions works for every pin; the venue page only
              exists for the ones we've onboarded, so an OSM result doesn't get
              a button that leads nowhere. */}
          <div className="flex gap-2 border-t border-gray-100 p-2.5 pt-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-[13px] font-bold text-gray-700 transition hover:border-brand hover:text-brand ${
                isPartner ? "flex-1" : "w-full"
              }`}
            >
              <LineIcon name="pin" size={13} />
              Directions
            </a>
            {isPartner && (
              <Link
                href={`/venues/${selected.id}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-[13px] font-bold text-white transition hover:opacity-90"
              >
                View venue
                <LineIcon name="chevronRight" size={13} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
