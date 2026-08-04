"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LineIcon from "../ui/LineIcon";
import { toast } from "@/lib/toast";

/**
 * Driver review.
 *
 * The ID scan lives in a private bucket, so it is fetched through a
 * short-lived signed URL created only when a reviewer asks to see it — never
 * embedded in the list. A government ID shouldn't be sitting in the DOM of a
 * page that happens to be open.
 */
interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  photo_url: string | null;
  id_type: string | null;
  id_number: string | null;
  id_document_url: string | null;
  licence_expiry: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_colour: string | null;
  vehicle_year: number | null;
  plate_number: string | null;
  vehicle_photo_url: string | null;
  seats: number;
  state: string | null;
  city: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const TABS = ["pending", "approved", "rejected", "suspended"] as const;

export default function AdminDrivers() {
  const supabase = createClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [rows, setRows] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [idUrl, setIdUrl] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      // Before the migration runs the table doesn't exist. Say so plainly
      // rather than showing an empty queue that looks like "no applicants".
      setUnavailable(/does not exist|schema cache/i.test(error.message));
      setRows([]);
      return;
    }
    setUnavailable(false);
    setRows((data ?? []) as Driver[]);
  }, [supabase, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(d: Driver, status: "approved" | "rejected" | "suspended") {
    setBusy(d.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("drivers")
      .update({
        status,
        admin_notes: notes[d.id]?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", d.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${d.full_name} ${status}`);
    setRows((r) => r.filter((x) => x.id !== d.id));
  }

  /** Mint a 60-second link to the private ID scan, on request only. */
  async function revealId(d: Driver) {
    if (!d.id_document_url) return;
    const { data, error } = await supabase.storage
      .from("driver-docs")
      .createSignedUrl(d.id_document_url, 60);
    if (error || !data) {
      toast.error("Couldn't open that document.");
      return;
    }
    setIdUrl((m) => ({ ...m, [d.id]: data.signedUrl }));
  }

  if (unavailable) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Driver sign-up isn&apos;t switched on yet — run
        <code className="mx-1 rounded bg-white/70 px-1">
          supabase/migration-drivers.sql
        </code>
        and this queue will fill.
      </p>
    );
  }

  return (
    <div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold capitalize transition ${
              tab === t
                ? "bg-brand text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Nothing {tab}.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.id} className="surface p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gray-100">
                  {d.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={d.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <LineIcon name="users" size={20} className="text-gray-400" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{d.full_name}</p>
                  <p className="text-sm text-gray-500">
                    {d.phone}
                    {d.city ? ` · ${d.city}` : ""}
                    {d.state ? `, ${d.state}` : ""}
                  </p>

                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
                    <Row k="Vehicle" v={[d.vehicle_colour, d.vehicle_make, d.vehicle_model].filter(Boolean).join(" ") || "—"} />
                    <Row k="Year" v={d.vehicle_year ? String(d.vehicle_year) : "—"} />
                    <Row k="Plate" v={d.plate_number ?? "—"} mono />
                    <Row k="ID type" v={d.id_type ?? "—"} />
                    <Row k="ID number" v={d.id_number ?? "—"} mono />
                    <Row k="Seats" v={String(d.seats)} />
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.id_document_url &&
                      (idUrl[d.id] ? (
                        <a
                          href={idUrl[d.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline px-3 py-1.5 text-xs"
                        >
                          Open ID (link valid 60s)
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revealId(d)}
                          className="btn-outline px-3 py-1.5 text-xs"
                        >
                          View ID document
                        </button>
                      ))}
                    {d.vehicle_photo_url && (
                      <a
                        href={d.vehicle_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline px-3 py-1.5 text-xs"
                      >
                        View car photo
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {d.admin_notes && tab !== "pending" && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {d.admin_notes}
                </p>
              )}

              <input
                value={notes[d.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                placeholder="Note to the driver (shown to them)"
                className="input mt-3 text-sm"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {tab !== "approved" && (
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => decide(d, "approved")}
                    className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {tab !== "rejected" && (
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => decide(d, "rejected")}
                    className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {tab === "approved" && (
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => decide(d, "suspended")}
                    className="flex-1 rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{k}</dt>
      <dd className={`text-gray-800 ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}
