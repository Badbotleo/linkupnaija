"use client";

import { useEffect, useState } from "react";
import LineIcon from "@/components/ui/LineIcon";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import type { Venue } from "@/lib/overpass";
import StateIcon from "@/components/ui/StateIcon";
import type { BookingOption } from "./BookingTerms";
import { formatNaira } from "@/lib/paystack";

export default function ReservationModal({
  venue,
  options = [],
  isLoggedIn,
  onClose,
}: {
  /**
   * Coordinates are nullable here, unlike on the OSM `Venue` this started
   * from. An onboarded venue we have not pinned yet has none, and the
   * caller was substituting 0 to satisfy the old type, which wrote a point
   * in the Atlantic onto the reservation as the venue's location.
   */
  venue: Omit<Pick<Venue, "id" | "name" | "address" | "lat" | "lng">, "lat" | "lng"> & {
    lat: number | null;
    lng: number | null;
  };
  /**
   * The venue's published booking options, if it has any.
   *
   * Asked here rather than settled later by email. A request that does not
   * say which option the group is taking is one the venue has to answer with
   * a policy, which is exactly the exchange that soured the Luna booking.
   */
  options?: BookingOption[];
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    event_name: "",
    date: "",
    time: "",
    group_size: "",
    event_type: "",
    special_requests: "",
    contact_phone: "",
    chosen_option: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal-mount only on the client so the modal is appended to <body>,
  // guaranteeing it stacks above the Leaflet map regardless of DOM nesting.
  useEffect(() => setMounted(true), []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please log in to request a reservation.");
      setLoading(false);
      return;
    }

    const partnerId = venue.id.startsWith("partner-")
      ? venue.id.slice("partner-".length)
      : null;

    const base = {
      user_id: user.id,
      venue_name: venue.name,
      venue_address: venue.address || null,
      venue_lat: venue.lat,
      venue_lng: venue.lng,
      event_name: form.event_name.trim(),
      event_type: form.event_type || null,
      date: form.date,
      time: form.time,
      group_size: form.group_size ? Number(form.group_size) : 1,
      special_requests: form.special_requests.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
    };

    // The chosen option, and what it is worth, carried on the row. Sent as a
    // second attempt rather than in `base` for the same reason venue_id is:
    // a column that has not landed yet must not take the whole booking down.
    const picked = options.find((o) => o.label === form.chosen_option);
    const withChoice = picked
      ? {
          ...base,
          chosen_option: picked.label,
          quoted_amount: picked.amount ?? null,
        }
      : base;

    // venue_id lands with migration-venue-reviews.sql. Until that runs the
    // column doesn't exist and including it would fail the whole insert —
    // so fall back to booking without it rather than blocking bookings.
    let { error } = await supabase
      .from("reservations")
      .insert({ ...withChoice, venue_id: partnerId });
    if (error && /venue_id|chosen_option|quoted_amount/.test(error.message)) {
      ({ error } = await supabase.from("reservations").insert(base));
    }

    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("Reservation request sent.");
    }
    setLoading(false);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Request a reservation
            </h2>
            <p className="text-sm text-gray-500">{venue.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <LineIcon name="x" size={16} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <StateIcon name="check" tone="good" size={48} />
            <p className="mt-3 font-semibold text-gray-900">
              Reservation request sent!
            </p>
            <p className="mt-1 text-sm text-gray-500">
              LinkUpNaija will confirm within 24 hours.
            </p>
            <button onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : !isLoggedIn ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">
              Log in to request a reservation at {venue.name}.
            </p>
            <Link href="/login?redirect=/venues" className="btn-primary mt-5">
              Log in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {/* FIRST, because it is the question the venue would otherwise
                ask in a reply. Picking it here turns a policy email into a
                line on the request, and gives the confirmation an amount
                that was agreed rather than invented. */}
            {options.length > 0 && (
              <div>
                <span className="label">How you want to book</span>
                <div className="mt-1 space-y-2">
                  {options.map((o) => {
                    const on = form.chosen_option === o.label;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => update("chosen_option", on ? "" : o.label)}
                        /* The selected fill needs its own dark value. The
                           rest of this modal uses light classes that the
                           global dark rules repaint, but bg-brand-50 is a
                           pale lavender that stays pale, so the chosen row
                           ended up light-on-light and the detail line under
                           it was barely readable. */
                        className={`flex w-full gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                          on
                            ? "border-brand bg-brand-50/60 dark:bg-brand/20"
                            : "border-gray-200 hover:border-brand/40 dark:border-white/15"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                            on
                              ? "border-brand bg-brand"
                              : "border-gray-300 dark:border-white/30"
                          }`}
                        >
                          {on && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[14.5px] font-bold text-gray-900 dark:text-white">
                              {o.label}
                            </span>
                            {typeof o.amount === "number" && o.amount > 0 && (
                              <span className="text-[14px] font-extrabold tabular-nums text-brand">
                                {formatNaira(o.amount)}
                              </span>
                            )}
                          </span>
                          {o.detail && (
                            <span className="mt-0.5 block text-[13px] leading-snug text-gray-600 dark:text-white/70">
                              {o.detail}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Not sure yet? Leave it and we will work it out with them.
                </p>
              </div>
            )}

            <div>
              <label className="label" htmlFor="event_name">
                Event name
              </label>
              <input
                id="event_name"
                required
                value={form.event_name}
                onChange={(e) => update("event_name", e.target.value)}
                placeholder="Tobi's Birthday Dinner"
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="time">
                  Time
                </label>
                <input
                  id="time"
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => update("time", e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="group_size">
                  Group size
                </label>
                <input
                  id="group_size"
                  type="number"
                  min={1}
                  required
                  value={form.group_size}
                  onChange={(e) => update("group_size", e.target.value)}
                  placeholder="10"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="event_type">
                  Event type
                </label>
                <select
                  id="event_type"
                  value={form.event_type}
                  onChange={(e) => update("event_type", e.target.value)}
                  className="input cursor-pointer"
                >
                  <option value="">Select type</option>
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="contact_phone">
                Contact phone
              </label>
              <input
                id="contact_phone"
                required
                value={form.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
                placeholder="080..."
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="special_requests">
                Special requests{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="special_requests"
                rows={3}
                value={form.special_requests}
                onChange={(e) => update("special_requests", e.target.value)}
                placeholder="Private area, decorations, dietary needs…"
                className="input resize-y"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Sending…" : "Send reservation request"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
