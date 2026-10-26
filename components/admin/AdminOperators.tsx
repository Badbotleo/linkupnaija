"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";
import type { Operator, OperatorDocument } from "@/lib/types";

/**
 * The transport partner queue.
 *
 * A company applies through /rides?tab=drive&as=company and lands here as
 * pending. Nothing routes a ride to them until an admin approves the record,
 * so this screen is the only thing between an application and a real partner.
 *
 * Documents live in a private bucket and are never shown inline: a link is
 * minted on request and lasts sixty seconds, the same handling as a driver's
 * ID scan. These are CAC certificates and bank details, not cover photos.
 */

const TABS = ["pending", "approved", "rejected", "suspended"] as const;
type Tab = (typeof TABS)[number];

interface Row extends Operator {
  documents: OperatorDocument[];
}

export default function AdminOperators() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rate, setRate] = useState<Record<string, string>>({});
  const [loginEmail, setLoginEmail] = useState<Record<string, string>>({});
  const [docUrl, setDocUrl] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("operators")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      // The table only exists once the operators migration has run.
      setUnavailable(error.code === "42P01");
      return;
    }
    setUnavailable(false);
    setRows((data ?? []) as Row[]);
  }, [supabase, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(o: Row, status: Operator["status"]) {
    setBusy(o.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const patch: Record<string, unknown> = {
      status,
      admin_notes: notes[o.id]?.trim() || null,
    };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = user?.id ?? null;
      const pct = Number(rate[o.id] ?? o.commission_percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        setBusy(null);
        toast.error("Commission must be a percentage between 0 and 100.");
        return;
      }
      patch.commission_percent = pct;
    }

    const { error } = await supabase.from("operators").update(patch).eq("id", o.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${o.business_name} ${status}`);
    setRows((r) => r.filter((x) => x.id !== o.id));
  }

  /**
   * Attach a login so the company can sign in and see its own jobs.
   *
   * The person must already have a LinkUpNaija account; we match on the email
   * they signed up with rather than creating one for them, because an account
   * we create has no password they chose and no agreement they accepted.
   */
  async function attachLogin(o: Row) {
    const email = loginEmail[o.id]?.trim().toLowerCase();
    if (!email) return;
    setBusy(o.id);
    const { data: u, error: findErr } = await supabase
      .from("users")
      .select("id, name")
      .ilike("email", email)
      .maybeSingle();

    if (findErr || !u) {
      setBusy(null);
      toast.error(
        `No LinkUpNaija account for ${email}. Ask them to sign up first, then attach it.`
      );
      return;
    }

    const { error } = await supabase
      .from("operators")
      .update({ user_id: u.id })
      .eq("id", o.id);
    setBusy(null);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "That account is already attached to another operator."
          : error.message
      );
      return;
    }
    toast.success(`Login attached to ${email}`);
    setRows((r) =>
      r.map((x) => (x.id === o.id ? { ...x, user_id: u.id as string } : x))
    );
  }

  /** A sixty-second link to one private document, minted on request only. */
  async function openDoc(o: Row, doc: OperatorDocument) {
    const { data, error } = await supabase.storage
      .from("operator-docs")
      .createSignedUrl(doc.path, 60);
    if (error || !data) {
      toast.error("Couldn't open that document.");
      return;
    }
    setDocUrl((m) => ({ ...m, [doc.path]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (unavailable) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Transport partners aren&apos;t switched on yet — run
        <code className="mx-1 rounded bg-white/70 px-1">
          supabase/migration-operators.sql
        </code>
        and this queue will fill.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize transition ${
              tab === t
                ? "bg-gray-900 text-white"
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
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
          No {tab} transport partners.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{o.business_name}</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {[o.contact_name, o.phone, o.email, o.city, o.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {o.rc_number ? `CAC ${o.rc_number}` : "No CAC number given"}
                    {o.tin ? ` · TIN ${o.tin}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold capitalize text-gray-600">
                  {o.status}
                </span>
              </div>

              {/* Documents, behind a click each */}
              <div className="mt-3">
                {o.documents?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {o.documents.map((d) => (
                      <button
                        key={d.path}
                        type="button"
                        onClick={() => openDoc(o, d)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand/40 hover:bg-white"
                      >
                        <LineIcon
                          name={d.type === "application/pdf" ? "file-text" : "image"}
                          size={13}
                          className="text-gray-400"
                        />
                        <span className="max-w-[180px] truncate">{d.name}</span>
                        {docUrl[d.path] && (
                          <span className="text-[10px] text-naija-600">opened</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No documents uploaded. Do not approve without CAC, insurance
                    and vehicle papers.
                  </p>
                )}
              </div>

              {/* Login */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {o.user_id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-naija-700">
                    <LineIcon name="check" size={13} />
                    Login attached
                  </span>
                ) : (
                  <>
                    <input
                      value={loginEmail[o.id] ?? ""}
                      onChange={(e) =>
                        setLoginEmail((m) => ({ ...m, [o.id]: e.target.value }))
                      }
                      placeholder="Their LinkUpNaija account email"
                      inputMode="email"
                      className="input h-9 flex-1 text-sm"
                      aria-label={`Account email for ${o.business_name}`}
                    />
                    <button
                      type="button"
                      onClick={() => attachLogin(o)}
                      disabled={busy === o.id || !loginEmail[o.id]?.trim()}
                      className="btn border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Attach login
                    </button>
                  </>
                )}
              </div>

              {/* Decision */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tab !== "approved" && (
                  <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    Commission
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={rate[o.id] ?? String(o.commission_percent ?? 5)}
                      onChange={(e) =>
                        setRate((m) => ({ ...m, [o.id]: e.target.value }))
                      }
                      className="input h-9 w-20 text-sm"
                      aria-label={`Commission percent for ${o.business_name}`}
                    />
                    %
                  </label>
                )}
                <input
                  value={notes[o.id] ?? ""}
                  onChange={(e) =>
                    setNotes((m) => ({ ...m, [o.id]: e.target.value }))
                  }
                  placeholder="Note to the operator, optional"
                  className="input h-9 min-w-[180px] flex-1 text-sm"
                  aria-label={`Note for ${o.business_name}`}
                />

                {tab !== "approved" && (
                  <button
                    type="button"
                    onClick={() => decide(o, "approved")}
                    disabled={busy === o.id}
                    className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40"
                  >
                    {busy === o.id ? "Saving…" : "Approve"}
                  </button>
                )}
                {tab === "pending" && (
                  <button
                    type="button"
                    onClick={() => decide(o, "rejected")}
                    disabled={busy === o.id}
                    className="btn border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Reject
                  </button>
                )}
                {tab === "approved" && (
                  <button
                    type="button"
                    onClick={() => decide(o, "suspended")}
                    disabled={busy === o.id}
                    className="btn border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
