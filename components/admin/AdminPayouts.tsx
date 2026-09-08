"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";

interface PayoutRow {
  id: string;
  amount: number;
  platform_fee: number;
  status: string;
  event_id: string | null;
  users: { name: string | null; payout_bank: string | null; payout_account_number: string | null } | null;
  events: { title: string | null; date: string | null } | null;
}

export default function AdminPayouts({
  initialPayouts,
  attendance = {},
}: {
  initialPayouts: PayoutRow[];
  /**
   * Scanned in against approved, per event.
   *
   * A fake link-up and a real one look the same on this screen. Nobody at the
   * door is the one signal worth checking before the money goes, and it was
   * already being collected.
   */
  attendance?: Record<string, { attended: number; going: number }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState(initialPayouts);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "approved" | "paid") {
    setBusyId(id);
    const { error } = await supabase
      .from("payouts")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setRows((prev) =>
        status === "paid"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      router.refresh();
    }
    setBusyId(null);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No payout requests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">
                {r.events?.title ?? "Event"}
              </p>
              <p className="text-sm text-gray-500">
                {r.users?.name ?? "Host"} ·{" "}
                {r.users?.payout_bank ?? "no bank set"}{" "}
                {r.users?.payout_account_number ?? ""}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold capitalize text-amber-700">
              {r.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Payout due:{" "}
            <span className="font-bold text-brand">{formatNaira(r.amount)}</span>{" "}
            (fee {formatNaira(r.platform_fee)})
          </p>
          {(() => {
            const a = r.event_id ? attendance[r.event_id] : undefined;
            if (!a || a.going === 0) return null;
            const none = a.attended === 0;
            return (
              <p
                className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-sm ${
                  none
                    ? "bg-red-50 font-semibold text-red-700"
                    : "text-gray-500"
                }`}
              >
                {a.attended} of {a.going} scanned in at the door
                {none && ". Check this one before paying."}
              </p>
            );
          })()}
          <div className="mt-3 flex gap-2">
            {r.status === "pending" && (
              <button
                type="button"
                onClick={() => setStatus(r.id, "approved")}
                disabled={busyId === r.id}
                className="btn-primary flex-1 py-2"
              >
                {busyId === r.id ? "…" : "Approve"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatus(r.id, "paid")}
              disabled={busyId === r.id}
              className="btn-outline flex-1 py-2"
            >
              Mark paid
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
