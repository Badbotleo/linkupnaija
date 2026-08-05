import AppHeader from "@/components/AppHeader";
import Avatar from "@/components/Avatar";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Top drivers",
  description:
    "Nigeria's best-rated LinkUpNaija drivers, ranked by riders who actually rode with them.",
};

interface Row {
  id: string;
  user_id: string;
  full_name: string;
  photo_url: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_colour: string | null;
  state: string | null;
  city: string | null;
  rating: number | null;
  trips_completed: number;
}

export default async function DriverLeaderboardPage() {
  const supabase = createClient();

  // Reads the view, not the table — it exposes only what a rider may see, so
  // no ID number or document can leak onto a public page.
  const { data, error } = await supabase
    .from("public_drivers")
    .select(
      "id, user_id, full_name, photo_url, vehicle_make, vehicle_model, vehicle_colour, state, city, rating, trips_completed"
    )
    .order("rating", { ascending: false, nullsFirst: false })
    .order("trips_completed", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Row[];
  // Before migration-drivers.sql runs, the view doesn't exist. Say so rather
  // than showing an empty board that reads as "no drivers".
  const notReady = !!error;

  return (
    <div>
      <AppHeader
        title="Top drivers"
        subtitle="Rated by riders who actually rode with them"
        back
      />

      <div className="container-page max-w-2xl py-5">
        {notReady ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Driver ratings aren&apos;t switched on yet — run
            <code className="mx-1 rounded bg-white/70 px-1">
              migration-drivers.sql
            </code>
            then
            <code className="mx-1 rounded bg-white/70 px-1">
              migration-driver-ratings.sql
            </code>
            .
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <p className="text-4xl">🚗</p>
            <h2 className="mt-3 text-lg font-bold text-gray-900">
              No drivers yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              Approved drivers appear here once riders start rating them.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {rows.map((d, i) => (
              <li key={d.id} className="surface flex items-center gap-3 p-4">
                <span
                  className={`w-6 shrink-0 text-center text-lg font-extrabold tabular-nums ${
                    i < 3 ? "text-brand" : "text-gray-300"
                  }`}
                >
                  {i + 1}
                </span>

                <Avatar
                  name={d.full_name}
                  url={d.photo_url}
                  seed={d.user_id}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900">
                    {d.full_name}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {[d.vehicle_colour, d.vehicle_make, d.vehicle_model]
                      .filter(Boolean)
                      .join(" ") || "Vehicle on file"}
                    {d.city ? ` · ${d.city}` : d.state ? ` · ${d.state}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1 font-extrabold text-gray-900">
                    <LineIcon name="star" size={14} filled className="text-amber-400" />
                    {/* An unrated driver shows a dash, never 0.0 — a new
                        driver is not a bad one. */}
                    {d.rating != null ? d.rating.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {d.trips_completed} trip{d.trips_completed === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
