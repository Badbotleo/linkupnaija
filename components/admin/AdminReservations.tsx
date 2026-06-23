"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";
import { formatEventDate, formatEventTime } from "@/lib/format";
import type { ReservationWithUser } from "@/lib/types";

export default function AdminReservations({
  initialReservations,
}: {
  initialReservations: ReservationWithUser[];
}) {
  const [items, setItems] = useState(initialReservations);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No pending reservations right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((r) => (
        <ReservationRow
          key={r.id}
          reservation={r}
          onResolved={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
        />
      ))}
    </div>
  );
}

function ReservationRow({
  reservation: r,
  onResolved,
}: {
  reservation: ReservationWithUser;
  onResolved: (id: string) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [commission, setCommission] = useState("");
  const [reason, setReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!commission) {
      setError("Enter a commission amount before confirming.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "confirmed",
        commission_amount: Math.round(Number(commission)),
      })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      setBusy(false);
    } else {
      onResolved(r.id);
      router.refresh();
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "declined", admin_notes: reason.trim() || null })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      setBusy(false);
    } else {
      onResolved(r.id);
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{r.venue_name}</p>
          <p className="text-sm text-gray-500">
            {r.event_name}
            {r.event_type ? ` · ${r.event_type}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
          Pending
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Detail label="Requested by" value={r.users?.name ?? "—"} />
        <Detail label="Email" value={r.users?.email ?? "—"} />
        <Detail
          label="Date & time"
          value={`${formatEventDate(r.date)} · ${formatEventTime(r.time)}`}
        />
        <Detail label="Group size" value={`${r.group_size}`} />
        <Detail label="Contact phone" value={r.contact_phone ?? "—"} />
        {r.venue_address && <Detail label="Address" value={r.venue_address} />}
      </dl>
      {r.special_requests && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
          “{r.special_requests}”
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!showDecline ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Commission ₦</span>
            <input
              type="number"
              min={0}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="0"
              className="input w-32 py-2"
            />
          </div>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="btn-primary flex-1 py-2 sm:flex-none"
            >
              {busy ? "…" : "Accept & confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              disabled={busy}
              className="btn flex-1 border border-red-200 bg-white py-2 text-red-600 hover:bg-red-50 sm:flex-none"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for declining (sent to the user)"
            className="input"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={decline}
              disabled={busy}
              className="btn flex-1 border border-red-200 bg-white py-2 text-red-600 hover:bg-red-50"
            >
              {busy ? "…" : "Confirm decline"}
            </button>
            <button
              type="button"
              onClick={() => setShowDecline(false)}
              disabled={busy}
              className="btn-outline py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {commission && !showDecline && (
        <p className="mt-2 text-xs text-gray-400">
          On confirm, the user is notified and a payment link is sent.
          Commission: {formatNaira(Math.round(Number(commission)) || 0)}.
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}
