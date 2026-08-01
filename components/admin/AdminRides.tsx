"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

interface RideRow {
  id: string;
  pickup: string;
  dropoff: string;
  state: string | null;
  ride_date: string;
  ride_time: string;
  passengers: number;
  vehicle_type: string;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  quoted_price: number | null;
  created_at: string;
  rider: { name: string | null; email: string | null } | null;
}

export default function AdminRides() {
  const supabase = createClient();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fare, setFare] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ride_requests")
      .select(
        "*, rider:users!ride_requests_user_id_fkey(name, email)"
      )
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    setRides((data ?? []) as unknown as RideRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(r: RideRow, status: "confirmed" | "declined" | "completed") {
    setBusyId(r.id);
    const patch: Record<string, unknown> = { status };
    if (status === "confirmed") {
      const n = Number(fare[r.id]);
      if (!n || n <= 0) {
        toast.error("Enter the fare before confirming.");
        setBusyId(null);
        return;
      }
      patch.quoted_price = Math.round(n);
    }
    if (status === "declined") patch.admin_notes = reason[r.id]?.trim() || null;

    const { error } = await supabase.from("ride_requests").update(patch).eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success(
        status === "confirmed"
          ? "Ride confirmed — rider notified"
          : status === "declined"
            ? "Ride declined — rider notified"
            : "Marked completed"
      );
      await load();
    }
    setBusyId(null);
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading rides…</p>;
  }

  if (rides.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No open ride requests right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rides.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-bold text-gray-900">
                <LineIcon name="car" size={16} className="shrink-0 text-brand" />
                <span className="truncate">
                  {r.pickup} → {r.dropoff}
                </span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {formatEventDate(r.ride_date)} · {r.ride_time.slice(0, 5)} ·{" "}
                {r.vehicle_type} · {r.passengers} pax
                {r.state ? ` · ${r.state}` : ""}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {r.rider?.name ?? "Member"}
                {r.contact_phone ? ` · ${r.contact_phone}` : ""}
                {r.rider?.email ? ` · ${r.rider.email}` : ""}
              </p>
              {r.notes && (
                <p className="mt-1 text-sm italic text-gray-500">“{r.notes}”</p>
              )}
              {r.quoted_price != null && (
                <p className="mt-1 text-sm font-bold text-naija-700">
                  Fare: ₦{r.quoted_price.toLocaleString("en-NG")}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                r.status === "confirmed"
                  ? "bg-naija-100 text-naija-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {r.status}
            </span>
          </div>

          {r.status === "pending" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                value={fare[r.id] ?? ""}
                onChange={(e) => setFare({ ...fare, [r.id]: e.target.value })}
                placeholder="Fare ₦"
                className="input w-32 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r, "confirmed")}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                Confirm
              </button>
              <input
                value={reason[r.id] ?? ""}
                onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                placeholder="Reason (if declining)"
                className="input flex-1 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r, "declined")}
                className="btn border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => decide(r, "completed")}
              className="btn-outline mt-3 px-4 py-2 text-sm disabled:opacity-50"
            >
              Mark completed
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
