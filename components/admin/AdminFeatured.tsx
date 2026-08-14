"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { formatEventDate } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import LineIcon from "../ui/LineIcon";

/**
 * Promoting an event, without the SQL editor.
 *
 * Featuring was a hand-written UPDATE, which meant nobody could see what was
 * currently boosted, when it ran out, or that it had run out at all. A paid
 * placement you can't audit is one you'll eventually forget to deliver.
 *
 * Uses the existing events.featured / featured_until columns. That flag is
 * the paid boost and nothing else — partner collaborations live on
 * partners.is_collab, kept separate so a host who paid can't quietly rank
 * below one who didn't.
 */

interface Row {
  id: string;
  title: string;
  date: string;
  state: string | null;
  price: number | null;
  featured: boolean;
  featured_until: string | null;
  host: { name: string | null } | null;
}

const DURATIONS = [
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

export default function AdminFeatured() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, date, state, price, featured, featured_until, host:users!events_host_id_fkey(name)"
      )
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(200);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const isLive = (r: Row) =>
    r.featured && !!r.featured_until && new Date(r.featured_until).getTime() > now;

  const live = useMemo(() => rows.filter(isLive), [rows]);
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      term
        ? rows.filter((r) =>
            [r.title, r.host?.name, r.state]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(term))
          )
        : rows,
    [rows, term]
  );

  async function feature(r: Row) {
    setBusy(r.id);
    // Never end a boost before the event happens — a placement that expires
    // the week before is a placement somebody paid for and didn't get.
    const eventEnd = new Date(`${r.date}T23:59:59`).getTime();
    const chosen = Date.now() + days * 86400000;
    const until = new Date(Math.max(eventEnd, chosen)).toISOString();

    const { error } = await supabase
      .from("events")
      .update({ featured: true, featured_until: until })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${r.title.slice(0, 28)} is featured`);
    load();
  }

  async function unfeature(r: Row) {
    setBusy(r.id);
    const { error } = await supabase
      .from("events")
      .update({ featured: false, featured_until: null })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    load();
  }

  const daysLeft = (until: string | null) =>
    until
      ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 86400000))
      : 0;

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">
          {live.length === 0
            ? "Nothing is featured right now."
            : `${live.length} event${live.length === 1 ? "" : "s"} featured`}
        </p>
        {live.length > 0 && (
          <ul className="mt-2 space-y-1">
            {live.map((r) => (
              <li key={r.id} className="text-xs text-amber-800">
                <span className="font-bold">{r.title}</span> ·{" "}
                {/* The number that actually matters: how long is left. */}
                {daysLeft(r.featured_until)} day
                {daysLeft(r.featured_until) === 1 ? "" : "s"} left
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by event, host or state"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <div className="flex shrink-0 gap-1 rounded-full bg-gray-100 p-1">
          {DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              onClick={() => setDays(d.days)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                days === d.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        A boost always expires — one with no end date is one somebody has to
        remember to switch off. It never ends before the event happens, whatever
        length you pick.
      </p>

      <ul className="space-y-2">
        {shown.map((r) => {
          const on = isLive(r);
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                on ? "border-amber-300 bg-amber-50/40" : "border-gray-200"
              }`}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/events/${r.id}`}
                  target="_blank"
                  className="truncate text-sm font-bold text-gray-900 hover:text-brand"
                >
                  {r.title}
                </Link>
                <p className="truncate text-xs text-gray-500">
                  {r.host?.name ?? "Host"} · {formatEventDate(r.date)}
                  {r.state ? ` · ${r.state}` : ""}
                  {r.price ? ` · ${formatNaira(r.price)}` : " · free"}
                </p>
              </div>
              {on && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">
                  {daysLeft(r.featured_until)}d left
                </span>
              )}
              <button
                type="button"
                onClick={() => (on ? unfeature(r) : feature(r))}
                disabled={busy === r.id}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                  on
                    ? "border border-gray-300 text-gray-700"
                    : "bg-brand text-white hover:bg-brand-600"
                }`}
              >
                <LineIcon name="star" size={13} />
                {busy === r.id ? "…" : on ? "Remove" : "Feature"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
