"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { WalletTransaction } from "@/lib/types";

const MIN_WITHDRAWAL = 1000;

export default function WalletCard({
  balance,
  transactions,
}: {
  balance: number;
  transactions: WalletTransaction[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function withdraw() {
    if (balance < MIN_WITHDRAWAL) return;
    const input = window.prompt(
      `Enter amount to withdraw (min ${formatNaira(MIN_WITHDRAWAL)}, available ${formatNaira(balance)}):`,
      String(balance)
    );
    if (input === null) return;
    const amount = Math.floor(Number(input));
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ${formatNaira(MIN_WITHDRAWAL)}.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("request_wallet_withdrawal", {
      p_amount: amount,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Withdrawal requested. We'll process it shortly.");
      router.refresh();
    }
  }

  const shown = showAll ? transactions : transactions.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {/* Balance header */}
      <div
        className="p-6 text-white"
        style={{ background: "linear-gradient(135deg,#534AB7,#3F3893)" }}
      >
        <p className="text-sm font-medium text-white/80">LinkUpNaija Wallet</p>
        <p className="mt-1 text-3xl font-extrabold">{formatNaira(balance)}</p>
        <button
          type="button"
          onClick={withdraw}
          disabled={busy || balance < MIN_WITHDRAWAL}
          className="mt-4 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
        >
          {busy ? "…" : "Withdraw"}
        </button>
        <p className="mt-2 text-xs text-white/60">
          Minimum withdrawal {formatNaira(MIN_WITHDRAWAL)}.
        </p>
      </div>

      {/* History */}
      <div className="p-5">
        <h3 className="text-sm font-bold text-gray-900">Transaction history</h3>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No transactions yet. Earn credit by referring friends!
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-gray-50">
              {shown.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {t.reason ?? (t.type === "credit" ? "Credit" : "Debit")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatEventDate(t.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      t.type === "credit" ? "text-green-600" : "text-gray-700"
                    }`}
                  >
                    {t.type === "credit" ? "+" : "−"}
                    {formatNaira(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {transactions.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="mt-3 text-sm font-semibold text-brand hover:underline"
              >
                {showAll ? "Show less" : `Show all ${transactions.length}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
