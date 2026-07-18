"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { CorporateAccount, CorporateStatus } from "@/lib/types";

const PIPELINE: { value: CorporateStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
];

export default function AdminCorporate({
  initial,
  adminId,
}: {
  initial: CorporateAccount[];
  adminId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  function patch(id: string, changes: Partial<CorporateAccount>) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }

  async function setStatus(a: CorporateAccount, status: CorporateStatus) {
    setBusy(a.id);
    const { error } = await supabase
      .from("corporate_accounts")
      .update({ status })
      .eq("id", a.id);
    if (!error) patch(a.id, { status });
    setBusy(null);
  }

  async function saveNotes(id: string, notes: string) {
    await supabase.from("corporate_accounts").update({ notes }).eq("id", id);
    toast.success("Notes saved");
  }

  async function togglePayment(a: CorporateAccount) {
    const next = !a.payment_received;
    patch(a.id, { payment_received: next });
    await supabase
      .from("corporate_accounts")
      .update({ payment_received: next })
      .eq("id", a.id);
  }

  async function createEvent(a: CorporateAccount) {
    setBusy(a.id);
    const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .insert({
        host_id: adminId,
        title: `🏢 ${a.company_name} · Corporate Event`,
        category: "Networking",
        description:
          a.requirements ||
          `Private corporate event for ${a.company_name}. Managed by LinkUpNaija.`,
        date,
        time: "18:00",
        location: a.state ? `${a.state} (TBC)` : "To be confirmed",
        state: a.state || "Lagos",
        event_type: "private",
        is_corporate: true,
        price: 0,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't create event");
      setBusy(null);
      return;
    }
    await supabase
      .from("corporate_accounts")
      .update({ event_id: data.id, status: "confirmed" })
      .eq("id", a.id);
    patch(a.id, { event_id: data.id, status: "confirmed" });
    setBusy(null);
    toast.success("Corporate event created 🏢");
    router.refresh();
  }

  const revenue = items
    .filter((a) => a.payment_received)
    .reduce((s, a) => s + planValue(a.plan), 0);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No corporate inquiries yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
        💰 Collected: ₦{revenue.toLocaleString()}
      </div>

      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900">
                  {a.company_name}
                  {a.plan && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">
                      {a.plan}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {[a.contact_name, a.email, a.phone].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {[
                    a.industry,
                    a.company_size && `${a.company_size} staff`,
                    a.event_type,
                    a.attendees && `~${a.attendees} attendees`,
                    a.state,
                    a.date_range,
                    a.budget_range,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {a.requirements && (
                  <p className="mt-1.5 text-sm text-gray-600">“{a.requirements}”</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={a.payment_received}
                  onChange={() => togglePayment(a)}
                  className="h-4 w-4 accent-brand"
                />
                Paid
              </label>
            </div>

            {/* Pipeline */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PIPELINE.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => setStatus(a, s.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    a.status === s.value
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Notes + event */}
            <div className="mt-3">
              <textarea
                defaultValue={a.notes ?? ""}
                onBlur={(e) => saveNotes(a.id, e.target.value)}
                rows={2}
                placeholder="Internal notes (saved on blur)…"
                className="input resize-y text-sm"
              />
            </div>

            <div className="mt-2">
              {a.event_id ? (
                <Link
                  href={`/events/${a.event_id}`}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  🏢 View corporate event →
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => createEvent(a)}
                  className="btn-primary py-1.5 text-sm"
                >
                  Confirm &amp; create corporate event
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function planValue(plan: CorporateAccount["plan"]): number {
  if (plan === "starter") return 50000;
  if (plan === "professional") return 150000;
  return 0; // enterprise = custom
}
