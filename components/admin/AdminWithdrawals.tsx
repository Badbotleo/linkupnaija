"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

export interface WithdrawalRow {
  id: string;
  amount: number;
  created_at: string;
  users: {
    name: string | null;
    email: string;
    payout_bank: string | null;
    payout_account_number: string | null;
  } | null;
}

/**
 * Referral withdrawals waiting to be paid.
 *
 * WHY THIS EXISTS. request_wallet_withdrawal() took the money out of the
 * member's balance, wrote a ledger row and told them it was "being
 * processed". Nothing was processing it: no admin screen read
 * wallet_transactions, so the request reached nobody. Two people had been
 * waiting a month when this was found, both for ₦3,000, and one of them had
 * resorted to asking through support by hand.
 *
 * AdminPayouts is the neighbouring screen and a different thing: that is
 * ticket money owed to a host for an event. This is referral credit owed to
 * a member. They were never the same queue, which is how one of them came to
 * have no queue at all.
 *
 * THE BANK DETAILS ARE ON THE ROW. Whoever is paying this has to open their
 * banking app and type an account number; making them go and find it on
 * another screen is how the wrong person gets paid.
 */
export default function AdminWithdrawals({
  initial,
}: {
  initial: WithdrawalRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function settle(id: string, status: "paid" | "declined") {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (
      !window.confirm(
        status === "paid"
          ? `Mark ${formatNaira(row.amount)} to ${
              row.users?.name ?? row.users?.email ?? "this member"
            } as paid? Do this after the transfer has actually left your bank.`
          : `Decline this withdrawal? ${formatNaira(
              row.amount
            )} goes straight back into their wallet and they are told why.`
      )
    ) {
      return;
    }
    setBusyId(id);
    const { error } = await supabase.rpc("admin_settle_withdrawal", {
      p_tx: id,
      p_status: status,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(status === "paid" ? "Marked as paid" : "Declined and refunded");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No withdrawal requests waiting.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const days = Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 86_400_000
        );
        const bank = r.users?.payout_bank;
        const acct = r.users?.payout_account_number;
        return (
          <div key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-gray-900">
                  {r.users?.name ?? "Unnamed"}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {r.users?.email}
                </p>
              </div>
              <p className="shrink-0 text-lg font-extrabold tabular-nums text-gray-900">
                {formatNaira(r.amount)}
              </p>
            </div>

            {/* How long they have been waiting, said plainly. A queue with no
                ages in it is how a request quietly becomes a month old. */}
            <p
              className={`mt-1.5 text-[12.5px] font-semibold ${
                days >= 7 ? "text-red-600" : "text-gray-500"
              }`}
            >
              {days === 0
                ? "Requested today"
                : `Waiting ${days} day${days === 1 ? "" : "s"}`}
            </p>

            {bank && acct ? (
              <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                {bank} · {acct}
              </p>
            ) : (
              /* Not a warning in passing: with no account on file there is
                 nowhere to send this, and marking it paid would be a lie. */
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <LineIcon name="shield" size={15} className="mt-0.5 shrink-0" />
                No bank details on their profile. Ask them to add one at
                /profile/edit/payouts before paying this.
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => settle(r.id, "paid")}
                disabled={busyId === r.id || !bank || !acct}
                className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
              >
                {busyId === r.id ? "…" : "Mark paid"}
              </button>
              <button
                type="button"
                onClick={() => settle(r.id, "declined")}
                disabled={busyId === r.id}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
