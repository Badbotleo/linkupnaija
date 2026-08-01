"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { geocode, distanceKm, DEFAULT_CENTER } from "@/lib/overpass";
import { VEHICLE_CLASSES, estimateFare, estimateMinutes, naira, type VehicleClass } from "@/lib/fares";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";
import Avatar from "@/components/Avatar";
import type { Point } from "./RideMap";

const RideMap = dynamic(() => import("./RideMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#E8E6F2]" />,
});

interface Friend {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

interface Invite {
  id: string;
  status: string;
  ride: {
    id: string;
    pickup: string;
    dropoff: string;
    ride_date: string;
    ride_time: string;
    vehicle_type: string;
    estimated_fare: number | null;
  } | null;
}

interface Ride {
  id: string;
  pickup: string;
  dropoff: string;
  ride_date: string;
  ride_time: string;
  vehicle_type: string;
  status: string;
  quoted_price: number | null;
  estimated_fare: number | null;
  admin_notes: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Finding a driver", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Driver confirmed", cls: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-600" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-600" },
};

export default function RideHailer({
  meId,
  myPhone,
  presetTo,
  presetEventTitle,
}: {
  meId: string;
  myPhone: string | null;
  /** Destination prefilled from an event page ("Hail a ride to this event"). */
  presetTo?: string | null;
  presetEventTitle?: string | null;
}) {
  const supabase = createClient();

  const [from, setFrom] = useState<Point | null>(null);
  const [to, setTo] = useState<Point | null>(null);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState(presetTo ?? "");
  const [locating, setLocating] = useState<"from" | "to" | null>(null);

  const [vehicle, setVehicle] = useState<VehicleClass>(VEHICLE_CLASSES[0]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState(myPhone ?? "");
  const [requesting, setRequesting] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);

  // Paddies to bring along — the fare splits across whoever comes.
  const [friends, setFriends] = useState<Friend[]>([]);
  const [paddies, setPaddies] = useState<Set<string>>(new Set());
  const [showPaddies, setShowPaddies] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);

  const km = from && to ? distanceKm(from.lat, from.lng, to.lat, to.lng) : 0;
  const ready = !!from && !!to;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ride_requests")
      .select("id, pickup, dropoff, ride_date, ride_time, vehicle_type, status, quoted_price, estimated_fare, admin_notes")
      .eq("user_id", meId)
      .order("created_at", { ascending: false })
      .limit(10);
    setRides((data ?? []) as Ride[]);
  }, [meId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve the destination handed over from an event page.
  useEffect(() => {
    if (!presetTo) return;
    (async () => {
      const p = await geocode(presetTo);
      if (p) setTo(p);
    })();
  }, [presetTo]);

  // Rides a paddy has added you to, still awaiting your answer.
  const loadInvites = useCallback(async () => {
    const { data } = await supabase
      .from("ride_companions")
      .select(
        "id, status, ride:ride_requests!ride_companions_ride_id_fkey(id, pickup, dropoff, ride_date, ride_time, vehicle_type, estimated_fare, user_id)"
      )
      .eq("user_id", meId)
      .eq("status", "invited");
    setInvites((data ?? []) as unknown as Invite[]);
  }, [meId, supabase]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function answerInvite(id: string, status: "accepted" | "declined") {
    const { error } = await supabase
      .from("ride_companions")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "accepted" ? "You're on the ride" : "Invite declined");
      await loadInvites();
    }
  }

  // Accepted connections, either direction — your paddies.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("connections")
        .select(
          "requester_id, receiver_id, requester:users!connections_requester_id_fkey(id, name, avatar_url), receiver:users!connections_receiver_id_fkey(id, name, avatar_url)"
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`);

      const rows = (data ?? []) as unknown as {
        requester_id: string;
        receiver_id: string;
        requester: Friend | null;
        receiver: Friend | null;
      }[];
      const list = rows
        .map((r) => (r.requester_id === meId ? r.receiver : r.requester))
        .filter((f): f is Friend => !!f);
      setFriends(list);
    })();
  }, [meId, supabase]);

  // Resolve a typed address to a point, debounced so we don't hammer Nominatim.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function resolve(which: "from" | "to", text: string) {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) {
      which === "from" ? setFrom(null) : setTo(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLocating(which);
      const p = await geocode(text.trim());
      setLocating(null);
      if (!p) {
        toast.error(`Couldn't find "${text.trim()}".`);
        return;
      }
      which === "from" ? setFrom(p) : setTo(p);
    }, 700);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser can't share location.");
      return;
    }
    setLocating("from");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current location",
        };
        setFrom(p);
        setFromText("Current location");
        setLocating(null);
      },
      () => {
        setLocating(null);
        toast.error("Couldn't get your location. Type the pick-up instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function request() {
    if (!from || !to) return;
    if (when === "later" && (!date || !time)) {
      toast.error("Pick a date and time for a scheduled ride.");
      return;
    }
    setRequesting(true);

    const now = new Date();
    const fare = estimateFare(vehicle, km);
    const { data: created, error } = await supabase
      .from("ride_requests")
      .insert({
        user_id: meId,
        pickup: from.label,
        dropoff: to.label,
        pickup_lat: from.lat,
        pickup_lng: from.lng,
        dropoff_lat: to.lat,
        dropoff_lng: to.lng,
        distance_km: Number((km * 1.35).toFixed(2)),
        estimated_fare: fare,
        vehicle_type: vehicle.key,
        passengers: 1 + paddies.size,
        ride_date: when === "now" ? now.toISOString().slice(0, 10) : date,
        ride_time: when === "now" ? now.toTimeString().slice(0, 5) : time,
        contact_phone: phone.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setRequesting(false);
      return;
    }

    // Bring the paddies along. A failure here shouldn't lose the ride itself.
    if (created && paddies.size > 0) {
      const { error: cErr } = await supabase.from("ride_companions").insert(
        Array.from(paddies).map((uid) => ({ ride_id: created.id, user_id: uid }))
      );
      if (cErr) toast.error("Ride booked, but we couldn't invite everyone.");
    }

    toast.success(
      paddies.size > 0
        ? `Ride requested — ${paddies.size} paddy${paddies.size === 1 ? "" : "s"} invited.`
        : "Ride requested — finding you a driver."
    );
    setTo(null);
    setToText("");
    setPaddies(new Set());
    await load();
    setRequesting(false);
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this ride?")) return;
    const { error } = await supabase.from("ride_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ride cancelled");
      await load();
    }
  }

  const active = rides.find((r) => r.status === "pending" || r.status === "confirmed");

  return (
    <div>
      {presetEventTitle && (
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-brand/25 bg-brand-50 px-4 py-3 sm:mx-0">
          <LineIcon name="calendar" size={16} className="shrink-0 text-brand" />
          <p className="min-w-0 text-sm text-gray-700">
            Ride to <span className="font-bold text-gray-900">{presetEventTitle}</span>
          </p>
        </div>
      )}

      {/* Paddy invited you to their ride */}
      {invites.length > 0 && (
        <div className="mb-3 space-y-2 px-4 sm:px-0">
          {invites.map((i) =>
            i.ride ? (
              <div
                key={i.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <LineIcon name="users" size={15} className="shrink-0 text-amber-600" />
                  A paddy added you to a ride
                </p>
                <p className="mt-1 truncate text-sm text-gray-700">
                  {i.ride.pickup} → {i.ride.dropoff}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatEventDate(i.ride.ride_date)} · {i.ride.ride_time.slice(0, 5)} ·{" "}
                  {i.ride.vehicle_type}
                  {i.ride.estimated_fare != null
                    ? ` · est. ${naira(i.ride.estimated_fare)} total`
                    : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => answerInvite(i.id, "accepted")}
                    className="btn-primary rounded-full px-4 py-1.5 text-sm"
                  >
                    I&apos;m in
                  </button>
                  <button
                    type="button"
                    onClick={() => answerInvite(i.id, "declined")}
                    className="btn border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Can&apos;t make it
                  </button>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Map — the screen leads with where you are, not with a form */}
      <div className="relative h-[38vh] min-h-[240px] w-full overflow-hidden sm:h-[44vh] sm:rounded-3xl">
        <RideMap from={from} to={to} center={from ?? DEFAULT_CENTER} />

        <button
          type="button"
          onClick={useMyLocation}
          aria-label="Use my location"
          className="absolute bottom-3 right-3 z-[500] grid h-11 w-11 place-items-center rounded-full bg-white text-brand shadow-lg transition active:scale-95"
        >
          <LineIcon name="pin" size={19} />
        </button>

        {ready && (
          <div className="absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-800 shadow-lg backdrop-blur">
            {(km * 1.35).toFixed(1)} km · about {estimateMinutes(km)} min
          </div>
        )}
      </div>

      {/* Sheet */}
      <div className="relative -mt-5 rounded-t-3xl bg-white px-4 pb-6 pt-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)] sm:mt-4 sm:rounded-3xl sm:border sm:border-gray-100">
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-gray-200 sm:hidden" />

        {/* Route inputs drawn as one journey */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" />
            <span className="my-1 w-px flex-1 border-l-2 border-dotted border-gray-300" />
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-900" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="relative">
              <input
                value={fromText}
                onChange={(e) => {
                  setFromText(e.target.value);
                  resolve("from", e.target.value);
                }}
                placeholder="Pick-up location"
                className="input w-full"
                aria-label="Pick-up location"
              />
              {locating === "from" && <Spinner />}
            </div>
            <div className="relative">
              <input
                value={toText}
                onChange={(e) => {
                  setToText(e.target.value);
                  resolve("to", e.target.value);
                }}
                placeholder="Where to?"
                className="input w-full"
                aria-label="Destination"
              />
              {locating === "to" && <Spinner />}
            </div>
          </div>
        </div>

        {/* Ride classes with live estimates — the Bolt/Uber choice moment */}
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4">
          {VEHICLE_CLASSES.map((v) => {
            const on = vehicle.key === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setVehicle(v)}
                aria-pressed={on}
                className={`w-[132px] shrink-0 rounded-2xl border p-3 text-left transition ${
                  on
                    ? "border-brand bg-brand-50 ring-1 ring-brand"
                    : "border-gray-200 bg-white hover:border-brand/40"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    on ? "bg-brand text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <LineIcon name={v.icon} size={16} />
                </span>
                <p className="mt-2 text-sm font-extrabold text-gray-900">{v.label}</p>
                <p className="text-[11px] text-gray-500">
                  {v.seats} · {v.etaMins} min
                </p>
                <p className="mt-1 text-sm font-black tabular-nums text-gray-900">
                  {ready ? naira(estimateFare(v, km)) : "—"}
                </p>
              </button>
            );
          })}
        </div>

        {/* When */}
        <div className="mt-4 flex gap-2">
          {(["now", "later"] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWhen(w)}
              aria-pressed={when === w}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                when === w
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {w === "now" ? "Ride now" : "Schedule"}
            </button>
          ))}
        </div>

        {when === "later" && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="input w-full"
              aria-label="Ride date"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input w-full"
              aria-label="Ride time"
            />
          </div>
        )}

        {/* Share with your paddies — fare splits across everyone riding */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={() => setShowPaddies((v) => !v)}
            aria-expanded={showPaddies}
            className="flex w-full items-center gap-2.5 text-left"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand shadow-sm">
              <LineIcon name="users" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-gray-900">
                Share with your paddies
              </span>
              <span className="block text-xs text-gray-500">
                {paddies.size > 0
                  ? `${paddies.size} coming · split ${ready ? naira(Math.ceil(estimateFare(vehicle, km) / (paddies.size + 1))) : "—"} each`
                  : "Split the fare with friends"}
              </span>
            </span>
            <span
              aria-hidden
              className={`shrink-0 text-gray-400 transition-transform duration-300 ${showPaddies ? "rotate-180" : ""}`}
            >
              <LineIcon name="chevronDown" size={18} />
            </span>
          </button>

          {showPaddies && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              {friends.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No paddies yet.{" "}
                  <Link href="/friends" className="font-bold text-brand hover:underline">
                    Add friends
                  </Link>{" "}
                  to split rides with them.
                </p>
              ) : (
                <div className="no-scrollbar flex max-h-44 flex-col gap-1 overflow-y-auto">
                  {friends.map((f) => {
                    const on = paddies.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setPaddies((prev) => {
                            const n = new Set(prev);
                            n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                            return n;
                          })
                        }
                        aria-pressed={on}
                        className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
                          on ? "bg-brand-50" : "hover:bg-white"
                        }`}
                      >
                        <Avatar name={f.name} url={f.avatar_url} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                          {f.name ?? "Member"}
                        </span>
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                            on ? "border-brand bg-brand text-white" : "border-gray-300"
                          }`}
                        >
                          {on && <LineIcon name="check" size={11} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone the driver should call"
          inputMode="tel"
          className="input mt-3 w-full"
          aria-label="Contact phone"
        />

        <button
          type="button"
          onClick={request}
          disabled={!ready || requesting}
          className="btn-primary mt-4 w-full rounded-full py-3.5 text-base disabled:opacity-40"
        >
          {requesting
            ? "Requesting…"
            : ready
              ? `Request ${vehicle.label} · ${naira(estimateFare(vehicle, km))}${paddies.size ? ` · ${naira(Math.ceil(estimateFare(vehicle, km) / (paddies.size + 1)))} each` : ""}`
              : "Set pick-up and destination"}
        </button>

        <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
          Fares are estimates. A vetted partner confirms the final price before
          anything is charged — nothing is paid here.
        </p>
      </div>

      {/* Active ride */}
      {active && (
        <div className="container-page mt-5 max-w-2xl px-0">
          <div className="rounded-2xl border border-brand/25 bg-brand-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-gray-900">
                  {active.pickup} → {active.dropoff}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {active.vehicle_type} ·{" "}
                  {active.quoted_price != null
                    ? `Fare ${naira(active.quoted_price)}`
                    : active.estimated_fare != null
                      ? `Est. ${naira(active.estimated_fare)}`
                      : ""}
                </p>
                {active.admin_notes && (
                  <p className="mt-1 text-sm text-gray-600">{active.admin_notes}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  (STATUS[active.status] ?? STATUS.pending).cls
                }`}
              >
                {(STATUS[active.status] ?? STATUS.pending).label}
              </span>
            </div>
            {active.status === "pending" && (
              <button
                type="button"
                onClick={() => cancel(active.id)}
                className="mt-3 text-sm font-semibold text-gray-500 transition hover:text-red-600"
              >
                Cancel ride
              </button>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {rides.filter((r) => r.id !== active?.id).length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
            Past rides
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            {rides
              .filter((r) => r.id !== active?.id)
              .map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
                    <LineIcon name="car" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {r.pickup} → {r.dropoff}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {formatEventDate(r.ride_date)} · {r.vehicle_type}
                      {r.quoted_price != null ? ` · ${naira(r.quoted_price)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      (STATUS[r.status] ?? STATUS.pending).cls
                    }`}
                  >
                    {(STATUS[r.status] ?? STATUS.pending).label}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Run a car-hire business?{" "}
        <Link href="/opportunities" className="font-bold text-brand hover:underline">
          List your vehicles
        </Link>
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-200 border-t-brand"
    />
  );
}
