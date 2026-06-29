"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Opportunity } from "@/lib/types";

const TYPE_LABELS: Record<Opportunity["type"], string> = {
  car_hire: "🚗 Car Hire",
  photographer: "📸 Photographers",
  venue: "🏛️ Venues",
};

export default function AdminOpportunities({
  initial,
}: {
  initial: Opportunity[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const { error } = await supabase
      .from("opportunities")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setItems((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );
      router.refresh();
    }
    setBusyId(null);
  }

  const groups = (["car_hire", "photographer", "venue"] as const).map(
    (type) => ({
      type,
      rows: items.filter((o) => o.type === type),
    })
  );

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No opportunity submissions yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.type}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            {TYPE_LABELS[g.type]}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
              {g.rows.length}
            </span>
          </h3>
          {g.rows.length === 0 ? (
            <p className="text-sm text-gray-400">None yet.</p>
          ) : (
            <ul className="space-y-2">
              {g.rows.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">
                        {o.business_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {[o.contact_name, o.phone, o.email, o.state]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {Object.keys(o.details || {}).length > 0 && (
                        <p className="mt-1 text-xs text-gray-400">
                          {Object.entries(o.details)
                            .map(
                              ([k, v]) =>
                                `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
                            )
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    {o.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => setStatus(o.id, "approved")}
                          className="btn-primary py-1.5 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => setStatus(o.id, "rejected")}
                          className="btn border border-red-200 bg-white py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          o.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {o.status}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
