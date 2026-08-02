"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATE_COORDS, NIGERIA_CENTER } from "@/lib/geo";
import { CATEGORY_STYLES } from "@/lib/constants";
import { formatEventDate } from "@/lib/format";

export interface MapEvent {
  id: string;
  title: string;
  state: string;
  category: string;
  date: string;
}

// A bare purple number told you a state had events but nothing about what
// they were. The marker now leads with the vibe — the emoji of whatever
// category dominates that state — and keeps the count as a badge.
function eventIcon(n: number, emoji: string) {
  const html = `
    <div style="position:relative;width:42px;height:42px">
      <div style="display:grid;place-items:center;width:42px;height:42px;border-radius:50%;
                  background:#fff;font-size:19px;line-height:1;
                  border:3px solid #534AB7;box-shadow:0 3px 8px rgba(26,16,64,.35)">${emoji}</div>
      ${
        n > 1
          ? `<span style="position:absolute;top:-4px;right:-4px;min-width:19px;height:19px;padding:0 4px;
                 display:grid;place-items:center;border-radius:10px;background:#008753;color:#fff;
                 font-size:11px;font-weight:800;border:2px solid #fff">${n}</span>`
          : ""
      }
    </div>`;
  return L.divIcon({ className: "", html, iconSize: [42, 42], iconAnchor: [21, 21] });
}

/** The category most represented in a state — what that pin should look like. */
function dominantEmoji(list: MapEvent[]): string {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  let best = "";
  let bestN = 0;
  counts.forEach((n, cat) => {
    if (n > bestN) {
      best = cat;
      bestN = n;
    }
  });
  return CATEGORY_STYLES[best as keyof typeof CATEGORY_STYLES]?.emoji ?? "📍";
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
            <Marker
              key={state}
              position={[c.lat, c.lng]}
              icon={eventIcon(list.length, dominantEmoji(list))}
            >
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
                        padding: "5px 0",
                        color: "#534AB7",
                        fontWeight: 600,
                        fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      {CATEGORY_STYLES[e.category as keyof typeof CATEGORY_STYLES]
                        ?.emoji ?? "📍"}{" "}
                      {e.title}
                      <span
                        style={{
                          display: "block",
                          color: "#6B7280",
                          fontWeight: 500,
                          fontSize: 11,
                        }}
                      >
                        {formatEventDate(e.date)}
                      </span>
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
