"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Venue } from "@/lib/overpass";

const PIN_SVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="#534AB7" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="white" stroke="none"/></svg>`;

function makeIcon(delayMs: number, ripple: boolean) {
  const html = ripple
    ? `<div style="position:relative"><span class="pin-ripple-ring"></span>${PIN_SVG}</div>`
    : `<div class="pin-drop" style="animation-delay:${delayMs}ms">${PIN_SVG}</div>`;
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
  zoom = 13,
  height = "360px",
  showPreview = true,
}: {
  center: { lat: number; lng: number };
  venues: Venue[];
  zoom?: number;
  height?: string;
  showPreview?: boolean;
}) {
  const [selected, setSelected] = useState<Venue | null>(null);

  // Stable per-marker icons (so selecting one doesn't re-drop the others).
  const baseIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    venues.forEach((v, i) => m.set(v.id, makeIcon(Math.min(i, 16) * 120, false)));
    return m;
  }, [venues]);
  const rippleIcon = useMemo(() => makeIcon(0, true), []);

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={center.lat} lng={center.lng} />
        <FlyToSelected venue={selected} />
        {venues.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={selected?.id === v.id ? rippleIcon : baseIcons.get(v.id)}
            eventHandlers={{ click: () => setSelected(v) }}
          />
        ))}
      </MapContainer>

      {/* Sliding preview card */}
      {showPreview && selected && (
        <div className="animate-fade-in-up absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold text-gray-900">{selected.name}</p>
              <p className="text-xs text-gray-500">{selected.category}</p>
              {selected.address && (
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  📍 {selected.address}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <Link
            href={`/venues/${selected.id}`}
            className="btn-primary mt-2 w-full py-1.5 text-sm"
          >
            View venue →
          </Link>
        </div>
      )}
    </div>
  );
}
