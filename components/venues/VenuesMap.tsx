"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Venue } from "@/lib/overpass";

const venueIcon = L.divIcon({
  className: "venue-pin",
  html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="#534AB7" stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="white" stroke="none"/></svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function VenuesMap({
  center,
  venues,
  zoom = 13,
  height = "360px",
}: {
  center: { lat: number; lng: number };
  venues: Venue[];
  zoom?: number;
  height?: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-100 shadow-card"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={center.lat} lng={center.lng} />
        {venues.map((v) => (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={venueIcon}>
            <Popup>
              <strong>{v.name}</strong>
              <br />
              {v.category}
              {v.address ? (
                <>
                  <br />
                  {v.address}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
