"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

const VEHICLES = [
  { key: "Sedan", icon: "car", seats: "1–4 seats", blurb: "Everyday runs" },
  { key: "SUV", icon: "car", seats: "1–6 seats", blurb: "More room, rough roads" },
  { key: "Bus", icon: "users", seats: "7–30 seats", blurb: "Moving the whole squad" },
  { key: "Luxury", icon: "star", seats: "1–4 seats", blurb: "Arrive in style" },
];

interface Ride {
  id: string;
  pickup: string;
  dropoff: string;
  ride_date: string;
  ride_time: string;
  passengers: number;
  vehicle_type: string;
  status: string;
  quoted_price: number | null;
  admin_notes: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Finding you a car", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-600" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-600" },
};

export default function RideRequestForm({
  meId,
  myState,
  myPhone,
}: {
  meId: string;
  myState: string | null;
  myPhone: string | null;
}) {
  const supabase = createClient();
  const [vehicle, setVehicle] = useState("Sedan");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [state, setState] = useState(myState ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [phone, setPhone] = useState(myPhone ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ride_requests")
      .select("id, pickup, dropoff, ride_date, ride_time, passengers, vehicle_type, status, quoted_price, admin_notes")
      .eq("user_id", meId)
      .order("created_at", { ascending: false });
    setRides((data ?? []) as Ride[]);
  }, [meId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickup.trim() || !dropoff.trim() || !date || !time) return;
    setSaving(true);

    const { error } = await supabase.from("ride_requests").insert({
      user_id: meId,
      pickup: pickup.trim(),
      dropoff: dropoff.trim(),
      state: state || null,
      ride_date: date,
      ride_time: time,
      passengers,
      vehicle_type: vehicle,
      contact_phone: phone.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Ride requested — we'll match you with a driver.");
      setPickup("");
      setDropoff("");
      setNotes("");
      await load();
    }
    setSaving(false);
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this ride request?")) return;
    const { error } = await supabase.from("ride_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Request cancelled");
      await load();
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-5">
        {/* Vehicle picker */}
        <div>
          <p className="mb-2 text-sm font-bold text-gray-900">What do you need?</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {VEHICLES.map((v) => {
              const on = vehicle === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVehicle(v.key)}
                  aria-pressed={on}
                  className={`rounded-2xl border p-3 text-left transition ${
                    on
                      ? "border-brand bg-brand-50 ring-1 ring-brand"
                      : "border-gray-200 bg-white hover:border-brand/40"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl ${
                      on ? "bg-brand text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <LineIcon name={v.icon} size={18} />
                  </span>
                  <p className="mt-2 text-sm font-extrabold text-gray-900">{v.key}</p>
                  <p className="text-[11px] text-gray-500">{v.seats}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{v.blurb}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Route — the two stops read as a journey, not two loose inputs */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-3">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              <span className="my-1 w-px flex-1 bg-gray-200" />
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-900" />
            </div>
            <div className="flex-1 space-y-2">
              <input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Pick-up — e.g. Lekki Phase 1"
                required
                className="input w-full"
                aria-label="Pick-up location"
              />
              <input
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="Drop-off — e.g. Victoria Island"
                required
                className="input w-full"
                aria-label="Drop-off location"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">Date</span>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">Pick-up time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">Passengers</span>
            <input
              type="number"
              min={1}
              max={60}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input w-full cursor-pointer"
            >
              <option value="">Select state…</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">
            Phone the driver should call
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080…"
            inputMode="tel"
            className="input w-full"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">
            Anything else? <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Luggage, extra stops, return trip…"
            className="input w-full resize-y"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full rounded-full py-3 text-base disabled:opacity-50"
        >
          {saving ? "Requesting…" : "Request a car"}
        </button>

        <p className="text-center text-xs leading-relaxed text-gray-500">
          We match you with a vetted LinkUpNaija car-hire partner and send the
          fare before anything is charged. Nothing is paid here.
        </p>
      </form>

      {/* Your requests */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-gray-900">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-brand">
            <LineIcon name="car" size={15} />
          </span>
          Your rides
          {rides.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600 tabular-nums">
              {rides.length}
            </span>
          )}
        </h2>

        {rides.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
            No rides yet. Request one above and we&apos;ll find you a driver.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rides.map((r) => {
              const s = STATUS[r.status] ?? STATUS.pending;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-900">
                        {r.pickup} → {r.dropoff}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {formatEventDate(r.ride_date)} · {r.ride_time.slice(0, 5)} ·{" "}
                        {r.vehicle_type} · {r.passengers} passenger
                        {r.passengers === 1 ? "" : "s"}
                      </p>
                      {r.quoted_price != null && (
                        <p className="mt-1 text-sm font-bold text-emerald-700">
                          Fare: ₦{r.quoted_price.toLocaleString("en-NG")}
                        </p>
                      )}
                      {r.admin_notes && (
                        <p className="mt-1 text-sm text-gray-600">{r.admin_notes}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => cancel(r.id)}
                      className="mt-3 text-sm font-semibold text-gray-400 transition hover:text-red-600"
                    >
                      Cancel request
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-sm text-gray-500">
        Run a car-hire business?{" "}
        <Link href="/opportunities" className="font-bold text-brand hover:underline">
          List your vehicles
        </Link>
      </p>
    </div>
  );
}
