"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEventDate } from "@/lib/format";
import { CATEGORY_STYLES } from "@/lib/constants";
import LineIcon from "../ui/LineIcon";

/**
 * Turns any upcoming event into an Instagram post we can publish from the
 * LinkUpNaija account: a 1080×1080 branded graphic built on the event's own
 * cover art, plus a caption that tags the host.
 *
 * Tagging the host is the whole point — it lands in their notifications and
 * they reshare it to their own following, which is free reach for the event.
 */

interface Row {
  id: string;
  title: string;
  category: string;
  state: string | null;
  location: string | null;
  date: string;
  price: number | null;
  cover_image_url: string | null;
  host: {
    name: string | null;
    instagram_url: string | null;
  } | null;
}

/** Pull "@handle" out of whatever an instagram_url happens to contain. */
export function instagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  // Users type all of these: a bare handle, "@handle", or a full profile URL.
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl ?? raw.replace(/^@/, "")).replace(/\/$/, "");
  if (!handle || /[\s/]/.test(handle)) return null;
  return `@${handle}`;
}

// Bump when the card design changes — old URLs stay cached, this one is new.
const CARD_VERSION = 2;

export default function AdminInstagram() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("events")
      .select(
        "id, title, category, state, location, date, price, cover_image_url, host:users!events_host_id_fkey(name, instagram_url)"
      )
      .gte("date", today)
      .order("date", { ascending: true })
      // Was 30, which quietly hid everything past about five weeks out.
      // DEFCON's SUMMER GAMES sits 41st of 55 upcoming events, so it simply
      // wasn't in the list and looked like it didn't exist. A cap is still
      // sensible, but it needs to be past the horizon people actually plan
      // to, and there's a search box below for anything beyond it.
      .limit(200)
      .then(({ data, error }) => {
        // Surface the failure instead of rendering an empty list that looks
        // like "no upcoming events".
        if (error) setError(error.message);
        else setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
  }, []);

  // Scanning 55 covers for one event is not a thing anyone should do.
  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) =>
        [r.title, r.location, r.state, r.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : rows;

  function caption(r: Row): string {
    const tag = instagramHandle(r.host?.instagram_url);
    const emoji =
      CATEGORY_STYLES[r.category as keyof typeof CATEGORY_STYLES]?.emoji ?? "📍";
    const where = r.location || r.state || "Nigeria";
    const money =
      r.price && r.price > 0 ? `₦${r.price.toLocaleString("en-NG")}` : "Free";

    return [
      `${emoji} ${r.title}`,
      "",
      `📅 ${formatEventDate(r.date)}`,
      `📍 ${where}`,
      `🎟️ ${money}`,
      "",
      tag
        ? `Hosted by ${tag} — tap the link in our bio to request a spot.`
        : `Tap the link in our bio to request a spot.`,
      "",
      "#LinkUpNaija #NaijaEvents #" + r.category.replace(/[^A-Za-z0-9]/g, ""),
    ].join("\n");
  }

  async function copy(r: Row) {
    try {
      await navigator.clipboard.writeText(caption(r));
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 2000);
    } catch {
      setError("Couldn't reach the clipboard — select the caption and copy it.");
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading events…</p>;

  if (error)
    return (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        Could not load events: {error}
      </p>
    );

  if (rows.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        No upcoming events to post yet.
      </p>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Download the square, post it from the LinkUpNaija account, and tag the
        host so it lands in their notifications and they reshare it.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, venue, state or category"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <p className="text-xs text-gray-400">
        {term
          ? `${shown.length} of ${rows.length} upcoming`
          : `${rows.length} upcoming`}
      </p>

      {term && shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
          Nothing matches &ldquo;{q.trim()}&rdquo;.
        </p>
      )}

      {shown.map((r) => {
        const tag = instagramHandle(r.host?.instagram_url);
        return (
          <div
            key={r.id}
            className="flex flex-col gap-4 surface p-4 sm:flex-row"
          >
            {/* Live preview of the exact graphic that downloads */}
            <a
              href={`/api/ig-card/${r.id}?v=${CARD_VERSION}`}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:w-40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/ig-card/${r.id}?v=${CARD_VERSION}`}
                alt={`Instagram graphic for ${r.title}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </a>

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-900">{r.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatEventDate(r.date)}
                {r.location ? ` · ${r.location}` : r.state ? ` · ${r.state}` : ""}
              </p>

              <p className="mt-2 text-xs">
                {tag ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-naija-50 px-2.5 py-1 font-bold text-naija-700">
                    Tag {tag}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                    {r.host?.name ?? "Host"} has no Instagram on file — nobody to
                    tag
                  </span>
                )}
              </p>

              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">
                {caption(r)}
              </pre>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/ig-card/${r.id}?v=${CARD_VERSION}`}
                  download={`linkupnaija-${r.id}.png`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
                >
                  <LineIcon name="image" size={15} />
                  Download square
                </a>
                <button
                  type="button"
                  onClick={() => copy(r)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand"
                >
                  <LineIcon name="check" size={15} />
                  {copied === r.id ? "Caption copied" : "Copy caption"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
