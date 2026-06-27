"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NIGERIAN_BANKS } from "@/lib/banks";

export default function PayoutSettings({
  userId,
  initial,
}: {
  userId: string;
  initial: {
    payout_bank: string | null;
    payout_account_number: string | null;
    payout_account_name: string | null;
  };
}) {
  const router = useRouter();
  const [bank, setBank] = useState(initial.payout_bank ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial.payout_account_number ?? ""
  );
  const [accountName, setAccountName] = useState(
    initial.payout_account_name ?? ""
  );
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    setMsg(null);
    const code = NIGERIAN_BANKS.find((b) => b.name === bank)?.code;
    if (!code || accountNumber.length < 10) {
      setError("Select a bank and enter a valid 10-digit account number.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/paystack/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber, bank_code: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not verify account.");
      } else if (data.account_name) {
        setAccountName(data.account_name);
        setMsg(`Verified: ${data.account_name}`);
      } else {
        setMsg(data.message || "Saved without verification.");
      }
    } catch {
      setError("Verification failed. Please try again.");
    }
    setVerifying(false);
  }

  async function save() {
    setError(null);
    setMsg(null);
    const code = NIGERIAN_BANKS.find((b) => b.name === bank)?.code;
    if (!code || accountNumber.length < 10) {
      setError("Select a bank and enter a valid 10-digit account number.");
      return;
    }
    setSaving(true);
    try {
      // Creates a real Paystack subaccount and persists payout details server-side.
      const res = await fetch("/api/paystack/subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_code: code,
          bank_name: bank,
          account_number: accountNumber,
          account_name: accountName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save payout details.");
      } else {
        if (data.account_name) setAccountName(data.account_name);
        setMsg("Payout details saved & subaccount created ✅");
        router.refresh();
      }
    } catch {
      setError("Could not save payout details. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <h2 className="text-lg font-bold text-gray-900">Payout Settings</h2>
      <p className="mt-1 text-sm text-gray-500">
        Add your bank details to receive payments from your hosted events.
        LinkUpNaija takes a 10% platform fee.
      </p>

      {initial.payout_bank && initial.payout_account_number && (
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
          <p className="font-semibold text-brand">Currently saving to</p>
          <p className="mt-0.5 text-gray-700">
            {initial.payout_account_name
              ? `${initial.payout_account_name} · `
              : ""}
            {initial.payout_bank} ••••
            {initial.payout_account_number.slice(-4)}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="bank" className="label">
            Bank
          </label>
          <select
            id="bank"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">Select your bank</option>
            {NIGERIAN_BANKS.map((b) => (
              <option key={b.code} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="acct" className="label">
            Account number
          </label>
          <input
            id="acct"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="0123456789"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="acctname" className="label">
            Account name
          </label>
          <input
            id="acctname"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Will auto-fill after verifying"
            className="input"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={verify}
            disabled={verifying}
            className="btn-outline"
          >
            {verifying ? "Verifying…" : "Verify account"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Save payout details"}
          </button>
        </div>
      </div>
    </div>
  );
}
