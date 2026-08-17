"use client";

import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";

/**
 * The tile layer, in one place so three maps can't drift apart.
 *
 * MapTiler rather than raw OpenStreetMap: same Leaflet, same data underneath,
 * a cartography that doesn't look like a wiki. No card and no meter — the
 * free tier is far above what 36 monthly users can reach.
 *
 * Falls back to OSM tiles when no key is set, so a missing env var degrades
 * to the map we already had rather than to a grey rectangle. That matters on
 * a preview deploy where the variable hasn't been added yet.
 */

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

const OSM = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

/** MapTiler's terms require their attribution alongside OSM's. */
const ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function MapTiles() {
  // Follows the app's theme, which now follows the phone. A white map inside
  // a black app is the one thing that would give the theme away.
  const [dark, setDark] = useState(false);
  const map = useMap();

  useEffect(() => {
    // Leaflet stamps its own name in front of the credits. That prefix is a
    // courtesy, not a licence condition, so it goes — the library doesn't
    // need billing on a page about parties.
    //
    // What stays is MapTiler and OpenStreetMap. Both are required: MapTiler's
    // free tier is conditional on the credit, and the map data itself is
    // ODbL, which wants attribution no matter who serves the tiles. Dropping
    // them risks the key, so they're styled down instead of taken out.
    map.attributionControl?.setPrefix("");
  }, [map]);

  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains("dark"));
    read();
    // The class is toggled by ThemeToggle and by the system listener, so
    // watch the attribute rather than reading a preference ourselves and
    // ending up with a second source of truth.
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  if (!KEY) return <TileLayer url={OSM.url} attribution={OSM.attribution} />;

  const style = dark ? "streets-v2-dark" : "streets-v2";
  return (
    <TileLayer
      // @2x for retina — a phone map on 1x tiles looks soft.
      url={`https://api.maptiler.com/maps/${style}/{z}/{x}/{y}@2x.png?key=${KEY}`}
      attribution={ATTRIBUTION}
      // MapTiler serves to zoom 20; Leaflet's default 18 throws away detail
      // that costs nothing.
      maxZoom={20}
    />
  );
}
