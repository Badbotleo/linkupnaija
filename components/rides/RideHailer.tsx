"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { geocode, distanceKm, DEFAULT_CENTER } from "@/lib/overpass";
import { VEHICLE_CLASSES, estimateFare, estimateMinutes, naira, type VehicleClass } from "@/lib/fares";
import { payWithPaystack } from "@/lib/paystack";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";
import Avatar from "@/components/Avatar";
import type { Point } from "./RideMap";

const RideMap = dynamic(() => import("./RideMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#E8E6F2] dark:bg-[#141414]" />,
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

interface RideOperator {
  id: string;
  business_name: string;
  commission_percent: number;
  subaccount_code: string | null;
}

/** The safe columns only. The ID number and document never leave the table. */
interface RideDriver {
  id: string;
  full_name: string;
  photo_url: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_colour: string | null;
  plate_number: string | null;
  rating: number | null;
  trips_completed: number;
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
  payment_status: string;
  rider_total: number | null;
  driver_id: string | null;
  completed_at: string | null;
  operator: RideOperator | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Finding you a car", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Car confirmed", cls: "bg-naija-100 text-naija-700" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-600" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-600" },
};

/** The booking fee a rider pays on top, when no operator rate is known yet. */
const DEFAULT_FEE_PERCENT = 5;

/** What the rider actually pays: the operator's fare plus our fee on top. */
function bookingFee(fare: number, percent = DEFAULT_FEE_PERCENT): number {
  return Math.ceil((fare * percent) / 100);
}

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
  const [payingId, setPayingId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Record<string, RideDriver>>({});
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Paddies to bring along — the fare splits across whoever comes.
  const [friends, setFriends] = useState<Friend[]>([]);
  const [paddies, setPaddies] = useState<Set<string>>(new Set());
  const [showPaddies, setShowPaddies] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);

  const km = from && to ? distanceKm(from.lat, from.lng, to.lat, to.lng) : 0;
  const ready = !!from && !!to;

  const BASE_COLS =
    "id, pickup, dropoff, ride_date, ride_time, vehicle_type, status, quoted_price, estimated_fare, admin_notes, driver_id, completed_at";

  /**
   * The drivers on these rides, and which trips this rider has already rated.
   *
   * Fetched separately rather than joined: `public_drivers` is a view, and
   * PostgREST cannot infer a foreign key to a view, so a nested select would
   * come back empty without saying why.
   */
  const loadTripPeople = useCallback(
    async (rows: Ride[]) => {
      const ids = Array.from(
        new Set(rows.map((r) => r.driver_id).filter((v): v is string => !!v))
      );
      if (ids.length) {
        const { data } = await supabase
          .from("public_drivers")
          .select(
            "id, full_name, photo_url, vehicle_make, vehicle_model, vehicle_colour, plate_number, rating, trips_completed"
          )
          .in("id", ids);
        const map: Record<string, RideDriver> = {};
        for (const d of (data ?? []) as RideDriver[]) map[d.id] = d;
        setDrivers(map);
      }

      const done = rows.filter((r) => r.completed_at).map((r) => r.id);
      if (done.length) {
        const { data } = await supabase
          .from("driver_ratings")
          .select("ride_id")
          .eq("rider_id", meId)
          .in("ride_id", done);
        setRated(new Set((data ?? []).map((r) => r.ride_id as string)));
      }
    },
    [meId, supabase]
  );

  const load = useCallback(async () => {
    // The operator join and the payment columns only exist once the operators
    // migration has run. If the app ships first, a hard failure here would
    // empty every rider's history with nothing on screen explaining it, so
    // fall back to the columns that have always been there.
    const full = await supabase
      .from("ride_requests")
      .select(
        `${BASE_COLS}, payment_status, rider_total, operator:operators_public(id, business_name, commission_percent, subaccount_code)`
      )
      .eq("user_id", meId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!full.error) {
      const rows = (full.data ?? []) as unknown as Ride[];
      setRides(rows);
      await loadTripPeople(rows);
      return;
    }

    const basic = await supabase
      .from("ride_requests")
      .select(BASE_COLS)
      .eq("user_id", meId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (basic.error) {
      console.error("[rides] could not load rides", basic.error);
      return;
    }
    const rows = (basic.data ?? []).map((r) => ({
      ...(r as Record<string, unknown>),
      payment_status: "unpaid",
      rider_total: null,
      operator: null,
    })) as unknown as Ride[];
    setRides(rows);
    await loadTripPeople(rows);
  }, [meId, supabase, loadTripPeople]);

  useEffect(() => {
    load();
  }, [load]);

  // A quote arrives from the operator minutes after the request, and the rider
  // is sitting on this screen waiting for it. Without this they would have to
  // guess when to pull to refresh, which is the difference between a ride app
  // and a form that emails you.
  useEffect(() => {
    const channel = supabase
      .channel(`rides:${meId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `user_id=eq.${meId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, supabase, load]);

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
  //
  // A timer EACH. One shared timer meant typing the destination cancelled the
  // pick-up's pending lookup, so filling both fields quickly left the pick-up
  // unresolved and every fare stuck on a dash, with nothing on screen saying
  // why. Found by filling the form fast, which is how people actually fill it.
  const timers = useRef<{
    from: ReturnType<typeof setTimeout> | null;
    to: ReturnType<typeof setTimeout> | null;
  }>({ from: null, to: null });

  function resolve(which: "from" | "to", text: string) {
    const pending = timers.current[which];
    if (pending) clearTimeout(pending);
    if (text.trim().length < 3) {
      which === "from" ? setFrom(null) : setTo(null);
      return;
    }
    timers.current[which] = setTimeout(async () => {
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
        ? `Ride requested. ${paddies.size} paddy${paddies.size === 1 ? "" : "s"} invited.`
        : "Ride requested. Finding you a driver."
    );
    setTo(null);
    setToText("");
    setPaddies(new Set());
    await load();
    setRequesting(false);
  }

  /**
   * Cancelling marks the ride cancelled rather than deleting it.
   *
   * A delete took the row away from the operator who was mid-quote and left no
   * trace that the trip was ever asked for. It would also strand a payment: a
   * paid ride whose row has gone is money with nothing to refund against.
   */
  async function cancel(id: string) {
    setCancelling(true);
    const { error } = await supabase
      .from("ride_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", meId);
    setCancelling(false);
    setConfirmCancel(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Ride cancelled");
      await load();
    }
  }

  /**
   * Rate the driver on a trip you took.
   *
   * The database has allowed this since the ratings migration and no screen
   * ever offered it, so in four months not one rating exists. The policy
   * already checks the ride was yours, names this driver, and is completed;
   * this only has to ask.
   */
  async function rate(ride: Ride, value: number) {
    if (!ride.driver_id) return;
    setSavingRating(true);
    const { error } = await supabase.from("driver_ratings").insert({
      driver_id: ride.driver_id,
      rider_id: meId,
      ride_id: ride.id,
      rating: value,
    });
    setSavingRating(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "You have already rated this trip."
          : error.message
      );
      return;
    }
    setRated((prev) => new Set(prev).add(ride.id));
    setRatingFor(null);
    setStars(0);
    toast.success("Thanks. That helps the next rider.");
    await load();
  }

  /** Pay the operator's quote. Paystack splits it as it is collected: the
   *  fare to their subaccount, our booking fee to us. */
  async function payForRide(ride: Ride) {
    if (!ride.quoted_price) return;
    const fare = ride.quoted_price;
    const percent = ride.operator?.commission_percent ?? DEFAULT_FEE_PERCENT;
    const fee = bookingFee(fare, percent);

    setPayingId(ride.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await payWithPaystack({
        email: user?.email ?? "",
        amountNaira: fare + fee,
        metadata: { purpose: "ride", rideId: ride.id, userId: meId },
        subaccount: ride.operator?.subaccount_code ?? undefined,
        platformFeeNaira: fee,
      });

      if (!result) return; // popup closed without paying

      // Never mark it paid from the browser. The server asks Paystack what
      // actually happened before a naira is recorded anywhere.
      const res = await fetch("/api/rides/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: ride.id, reference: result.reference }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || "We could not confirm that payment.");
        return;
      }
      toast.success(data.warning ? data.warning : "Paid. Your driver is on the way.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Payment could not be started."
      );
    } finally {
      setPayingId(null);
    }
  }

  const active = rides.find(
    (r) => r.status === "pending" || r.status === "confirmed"
  );

  /** What the rider will actually be charged for the class they picked. */
  const estimate = ready ? estimateFare(vehicle, km) : 0;
  const estimateTotal = estimate + bookingFee(estimate);

  return (
    <div>
      <BookBar
        label={
          requesting
            ? "Requesting…"
            : ready
              ? `Request ${vehicle.label} · about ${naira(estimateTotal)}`
              : "Set pick-up and destination"
        }
        disabled={!ready || requesting}
        onClick={request}
      />
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

      {/* Map — the screen leads with where you are, not with a form.
          38vh was a strip: on a 812px phone that is 308px of map under a
          header, with the form taking the rest, so the thing the screen is
          about got less room than the thing you fill in afterwards. Snapchat
          and every ride app give the map the screen and float the controls
          over it, and the sheet below already overlaps by 20px, so the
          pattern was half built. 62vh is 500px of map on that same phone,
          and the sheet still starts above the fold so nothing is hidden. */}
      <div className="relative h-[62vh] min-h-[320px] w-full overflow-hidden sm:h-[64vh] sm:rounded-3xl">
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
                  {ready
                    ? naira(estimateFare(v, km) + bookingFee(estimateFare(v, km)))
                    : "—"}
                </p>
              </button>
            );
          })}
        </div>

        {ready && (
          <p className="mt-2 text-[11px] text-gray-500">
            Prices include the {DEFAULT_FEE_PERCENT}% booking fee. The partner
            confirms the exact fare before you pay.
          </p>
        )}

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
                  ? `${paddies.size} coming · split ${ready ? naira(Math.ceil(estimateTotal / (paddies.size + 1))) : "—"} each`
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
              ? `Request ${vehicle.label} · about ${naira(estimateTotal)}${paddies.size ? ` · ${naira(Math.ceil(estimateTotal / (paddies.size + 1)))} each` : ""}`
              : "Set pick-up and destination"}
        </button>

        {/* Clears the pinned bar on a phone so the last field is not hidden
            behind it. Nothing to clear once the bar goes static. */}
        <p className="mt-2 pb-28 text-center text-[11px] leading-relaxed text-gray-500 sm:pb-0">
          Fares are estimates. A vetted partner confirms the real price first,
          then you pay here with a {DEFAULT_FEE_PERCENT}% booking fee on top.
          Nothing is charged until you have seen the final figure.
        </p>
      </div>

      {/* Active ride: the screen the rider actually sits on while they wait */}
      {active && (
        <div className="container-page mt-5 max-w-2xl px-0">
          <div className="overflow-hidden rounded-2xl border border-brand/25 bg-white">
            <div className="bg-brand-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-gray-900">
                    {active.pickup} → {active.dropoff}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {active.vehicle_type}
                    {active.operator ? ` · ${active.operator.business_name}` : ""}
                  </p>
                  {active.admin_notes && (
                    <p className="mt-1 text-sm text-gray-600">{active.admin_notes}</p>
                  )}
                </div>
                <span
                  aria-live="polite"
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    (STATUS[active.status] ?? STATUS.pending).cls
                  }`}
                >
                  {(STATUS[active.status] ?? STATUS.pending).label}
                </span>
              </div>

              {active.status === "pending" && (
                <p className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                  />
                  We are matching you with a partner. This page updates itself,
                  no need to refresh.
                </p>
              )}
            </div>

            {/* The quote. Every naira named before anything is charged. */}
            {active.quoted_price != null && active.payment_status !== "paid" && (
              <div className="border-t border-brand/15 p-4">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">
                      Fare{active.operator ? ` to ${active.operator.business_name}` : ""}
                    </dt>
                    <dd className="font-bold tabular-nums text-gray-900">
                      {naira(active.quoted_price)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">
                      Booking fee (
                      {active.operator?.commission_percent ?? DEFAULT_FEE_PERCENT}%)
                    </dt>
                    <dd className="font-bold tabular-nums text-gray-900">
                      {naira(
                        bookingFee(
                          active.quoted_price,
                          active.operator?.commission_percent ?? DEFAULT_FEE_PERCENT
                        )
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-gray-100 pt-1.5">
                    <dt className="font-bold text-gray-900">You pay</dt>
                    <dd className="text-lg font-black tabular-nums text-gray-900">
                      {naira(
                        active.quoted_price +
                          bookingFee(
                            active.quoted_price,
                            active.operator?.commission_percent ?? DEFAULT_FEE_PERCENT
                          )
                      )}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => payForRide(active)}
                  disabled={payingId === active.id}
                  className="btn-primary mt-3 w-full rounded-full py-3 disabled:opacity-40"
                >
                  {payingId === active.id ? "Opening payment…" : "Pay and confirm"}
                </button>
                <p className="mt-2 text-center text-[11px] text-gray-500">
                  The driver is paid directly. We never hold your fare.
                </p>
              </div>
            )}

            {/* Who is collecting you. The single most useful thing on this
                screen, and for a woman leaving a venue at 1am it is the
                reason the product exists. */}
            {active.driver_id && drivers[active.driver_id] && (
              <div className="flex items-center gap-3 border-t border-brand/15 p-4">
                <Avatar
                  name={drivers[active.driver_id].full_name}
                  url={drivers[active.driver_id].photo_url}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900">
                    {drivers[active.driver_id].full_name}
                  </p>
                  <p className="truncate text-sm text-gray-600">
                    {[
                      drivers[active.driver_id].vehicle_colour,
                      drivers[active.driver_id].vehicle_make,
                      drivers[active.driver_id].vehicle_model,
                    ]
                      .filter(Boolean)
                      .join(" ") || active.vehicle_type}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {drivers[active.driver_id].rating != null && (
                      <span className="inline-flex items-center gap-1 font-bold text-gray-700">
                        <LineIcon name="star" size={12} />
                        {drivers[active.driver_id].rating}
                      </span>
                    )}
                    <span>
                      {drivers[active.driver_id].trips_completed} trips
                    </span>
                  </p>
                </div>
                {drivers[active.driver_id].plate_number && (
                  <span className="shrink-0 rounded-lg border-2 border-gray-900 px-2.5 py-1 font-mono text-sm font-black tracking-wider text-gray-900">
                    {drivers[active.driver_id].plate_number}
                  </span>
                )}
              </div>
            )}

            {active.payment_status === "paid" && (
              <div className="flex items-center gap-2.5 border-t border-naija-200 bg-naija-50 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-naija-600 text-white">
                  <LineIcon name="check" size={16} />
                </span>
                <p className="text-sm font-bold text-gray-900">
                  Paid{active.rider_total != null ? ` · ${naira(active.rider_total)}` : ""}
                  <span className="block text-xs font-normal text-gray-600">
                    Your driver has been notified.
                  </span>
                </p>
              </div>
            )}

            {(active.status === "pending" || active.payment_status !== "paid") && (
              <div className="border-t border-gray-100 px-4 py-3">
                {confirmCancel === active.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-auto text-sm text-gray-700">Cancel this ride?</p>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(null)}
                      className="btn border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(active.id)}
                      disabled={cancelling}
                      className="btn bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelling ? "Cancelling…" : "Yes, cancel"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(active.id)}
                    className="text-sm font-semibold text-gray-500 transition hover:text-red-600"
                  >
                    Cancel ride
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* A finished trip you have not rated yet. Asked once, on the screen
          you are already on, rather than in an email nobody opens. */}
      {rides
        .filter(
          (r) => r.completed_at && r.driver_id && !rated.has(r.id)
        )
        .slice(0, 1)
        .map((r) => {
          const d = r.driver_id ? drivers[r.driver_id] : null;
          return (
            <div className="container-page mt-5 max-w-2xl px-0" key={r.id}>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="font-bold text-gray-900">
                  How was your trip{d ? ` with ${d.full_name}` : ""}?
                </p>
                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {r.pickup} to {r.dropoff}
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = (ratingFor === r.id ? stars : 0) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        onClick={() => {
                          setRatingFor(r.id);
                          setStars(n);
                        }}
                        className={`grid h-10 w-10 place-items-center rounded-full transition ${
                          on
                            ? "bg-amber-100 text-amber-500"
                            : "bg-gray-100 text-gray-300 hover:text-gray-400"
                        }`}
                      >
                        <LineIcon name="star" size={19} />
                      </button>
                    );
                  })}

                  {ratingFor === r.id && stars > 0 && (
                    <button
                      type="button"
                      onClick={() => rate(r, stars)}
                      disabled={savingRating}
                      className="btn-primary ml-auto rounded-full px-4 py-2 text-sm disabled:opacity-40"
                    >
                      {savingRating ? "Sending…" : "Send"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

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
        <Link
          href="/rides?tab=drive"
          className="font-bold text-brand hover:underline"
        >
          List your vehicles
        </Link>
      </p>
    </div>
  );
}

/**
 * The book button, pinned to the screen on a phone.
 *
 * PORTALLED TO <body>, WHICH IS NOT OPTIONAL. The first version rendered
 * this bar in place inside the sheet and it never appeared: a transformed
 * ancestor becomes the containing block for position:fixed, so "fixed to the
 * bottom" quietly meant "fixed to the bottom of that ancestor", which is
 * somewhere far below the fold. StickyJoinBar carries the same warning and
 * calls it the sixth time this has bitten in this codebase. Seventh.
 *
 * The real button stays inline in the sheet for anyone who scrolls to it and
 * for every screen from sm up. This is the same action, reachable without
 * scrolling past the map.
 *
 * The 53px offset clears the bottom nav, which a bar at bottom-0 would sit
 * underneath.
 */
function BookBar({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-[calc(53px_+_env(safe-area-inset-bottom))] z-30 border-t border-gray-100 bg-white/90 px-4 py-3 backdrop-blur-xl sm:hidden dark:border-white/10 dark:bg-black/85">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="btn-primary w-full rounded-full py-3.5 text-base disabled:opacity-40"
      >
        {label}
      </button>
    </div>,
    document.body
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
