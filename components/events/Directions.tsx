import LineIcon from "@/components/ui/LineIcon";

/**
 * Where it is, and one tap to get there.
 *
 * Events carry a text address and nothing else: no latitude, no longitude,
 * no place id. So there is nothing to drop a pin on without geocoding
 * first, and the Overpass mirrors this app already leans on for venues were
 * timing out and serving an expired certificate the day this was written.
 * A map that fails is worse than no map, because it fails in the place
 * somebody is standing in the street trying to use it.
 *
 * TWO LEVELS, AND THE USEFUL ONE NEEDS NO KEY.
 *
 * The buttons always work. They hand the address to whatever maps app the
 * phone already has, signed in, with the person's own saved places and live
 * traffic. On a phone that is better than any iframe: nobody navigates
 * inside an embed, they tap through to their maps app and we are just the
 * extra tap in the way.
 *
 * The embedded map renders only when NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY is
 * set. Google's Embed API takes a text query, so it geocodes server side and
 * we never have to. Without the key the section is the two buttons, which is
 * the whole job done.
 *
 * The state is appended to the query because "The Stable, 41 Bode Thomas
 * Street" is several places in Nigeria and exactly one in Lagos.
 */
export default function Directions({
  location,
  state,
}: {
  location: string;
  state?: string | null;
}) {
  // "FCT - Abuja" is how the database spells it and not how anybody searches.
  const place = state ? state.replace(/^FCT\s*-\s*/, "").trim() : null;
  // Hosts usually type the city into the address themselves, so appending
  // the state unconditionally produced "Café One, Abuja, Abuja, Nigeria".
  // Google forgives that; a person reading the link does not.
  const needsPlace =
    !!place && !location.toLowerCase().includes(place.toLowerCase());
  const query = [location, needsPlace ? place : null, "Nigeria"]
    .filter(Boolean)
    .join(", ");
  const q = encodeURIComponent(query);

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

  return (
    <section className="mt-8" aria-labelledby="directions-heading">
      <h2
        id="directions-heading"
        className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white"
      >
        Directions
      </h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-white/60">{location}</p>

      {key && (
        <iframe
          title={`Map of ${location}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="mt-3 h-[260px] w-full rounded-2xl border border-gray-200 dark:border-white/10"
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center gap-2"
        >
          <LineIcon name="pin" size={17} />
          Get directions
        </a>
        {/* An iPhone opens maps.apple.com in Apple Maps rather than a browser
            tab, which is the app most of these people already use. */}
        <a
          href={`https://maps.apple.com/?q=${q}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex items-center gap-2"
        >
          Open in Maps
        </a>
      </div>
    </section>
  );
}
