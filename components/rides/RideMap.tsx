"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface Point {
  lat: number;
  lng: number;
  label: string;
}

const dot = (fill: string, ring: string) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;
      background:${fill};box-shadow:0 0 0 4px ${ring},0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const PICKUP = dot("#534AB7", "rgba(83,74,183,.25)");
const DROPOFF = dot("#111827", "rgba(17,24,39,.18)");

// Keep both ends of the trip in frame as they're chosen.
function Fit({ from, to }: { from: Point | null; to: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (from && to) {
      map.fitBounds(
        L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]).pad(0.35),
        { animate: true }
      );
    } else if (from) {
      map.flyTo([from.lat, from.lng], 14, { duration: 0.6 });
    } else if (to) {
      map.flyTo([to.lat, to.lng], 14, { duration: 0.6 });
    }
  }, [from, to, map]);
  return null;
}

export default function RideMap({
  from,
  to,
  center,
}: {
  from: Point | null;
  to: Point | null;
  center: { lat: number; lng: number };
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "#E8E6F2" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {from && <Marker position={[from.lat, from.lng]} icon={PICKUP} />}
      {to && <Marker position={[to.lat, to.lng]} icon={DROPOFF} />}
      {from && to && (
        <Polyline
          positions={[
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]}
          pathOptions={{ color: "#534AB7", weight: 4, opacity: 0.85, dashArray: "1 8", lineCap: "round" }}
        />
      )}
      <Fit from={from} to={to} />
    </MapContainer>
  );
}
