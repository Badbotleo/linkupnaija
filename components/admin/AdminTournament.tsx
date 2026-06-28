"use client";

import { formatNaira } from "@/lib/paystack";
import { TOURNAMENT } from "@/lib/tournament";
import type { TournamentRegistration } from "@/lib/types";

export default function AdminTournament({
  registrations,
}: {
  registrations: TournamentRegistration[];
}) {
  const paidCount = registrations.filter((r) => r.paid).length;
  const collected = paidCount * TOURNAMENT.regFee;

  function exportCsv() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "State",
      "PSN ID",
      "Paid",
      "Reference",
      "Registered",
    ];
    const rows = registrations.map((r) => [
      r.name,
      r.email,
      r.phone,
      r.state ?? "",
      r.psn_id ?? "",
      r.paid ? "Yes" : "No",
      r.payment_reference ?? "",
      new Date(r.created_at).toISOString(),
    ]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fc26-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700">
            {registrations.length} registered ({paidCount} paid)
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
            Collected: {formatNaira(collected)}
          </span>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={registrations.length === 0}
          className="btn-outline py-2"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
        {registrations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            No registrations yet.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">PSN ID</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.email}</td>
                  <td className="px-4 py-3 text-gray-600">{r.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{r.state ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.psn_id ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        r.paid
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.paid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(r.created_at).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
