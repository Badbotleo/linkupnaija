"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATE_COORDS, NIGERIA_CENTER } from "@/lib/geo";

export interface MapEvent {
  id: string;
  title: string;
  state: string;
  category: string;
  date: string;
}

function countIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#534AB7;color:#fff;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Discovery map: events clustered per Nigerian state (events have no exact
// coordinates, only a state), so each marker sits at the state centroid and
// its popup lists what's happening there.
export default function EventsMap({ events }: { events: MapEvent[] }) {
  const byState = useMemo(() => {
    const m = new Map<string, MapEvent[]>();
    for (const e of events) {
      if (!STATE_COORDS[e.state]) continue;
      (m.get(e.state) ?? m.set(e.state, []).get(e.state)!).push(e);
    }
    return m;
  }, [events]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-gray-100 shadow-card">
      <MapContainer
        center={[NIGERIA_CENTER.lat, NIGERIA_CENTER.lng]}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Array.from(byState.entries()).map(([state, list]) => {
          const c = STATE_COORDS[state];
          return (
            <Marker key={state} position={[c.lat, c.lng]} icon={countIcon(list.length)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#1A1040" }}>
                    📍 {state} · {list.length} event{list.length === 1 ? "" : "s"}
                  </p>
                  {list.slice(0, 6).map((e) => (
                    <Link
                      key={e.id}
                      href={`/events/${e.id}`}
                      style={{
                        display: "block",
                        padding: "4px 0",
                        color: "#534AB7",
                        fontWeight: 600,
                        fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      {e.title}
                    </Link>
                  ))}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
