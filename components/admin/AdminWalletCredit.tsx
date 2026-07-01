"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";
import { toast } from "@/lib/toast";

export default function AdminWalletCredit({
  users,
}: {
  users: { id: string; name: string | null; email: string }[];
}) {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.floor(Number(amount));
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Pick a user and a valid amount.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_credit_wallet", {
      p_user: userId,
      p_amount: amt,
      p_reason: reason.trim() || "Admin credit",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Credited ${formatNaira(amt)} ✅`);
      setAmount("");
      setReason("");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">User</span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input"
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? "Unnamed"} · {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Amount (₦)</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="input"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="label">Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Compensation for cancelled event"
          className="input"
        />
      </label>
      <button type="submit" disabled={busy} className="btn-primary mt-4">
        {busy ? "Crediting…" : "Credit wallet"}
      </button>
    </form>
  );
}
