"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import Avatar from "@/components/Avatar";
import LineIcon from "@/components/ui/LineIcon";

/**
 * "I run this place" — the queue where somebody says yes.
 *
 * A claim hands over the right to change a listing 257 venues deep in a
 * directory people book from, so nothing about it is automatic. RLS lets a
 * claimant write exactly one row, pending, and refuses every other status;
 * this screen is the only way one moves.
 *
 * WHAT TO CHECK, since the screen cannot check it for you. The contact is the
 * evidence: an email on the venue's own domain, or the phone already printed
 * on the listing. Both are visible side by side here for exactly that reason,
 * and neither is verified by us — pretending otherwise would be worse than
 * asking a person to look.
 *
 * A plain UPDATE rather than an RPC, unlike the ID checks queue next door.
 * That one stamps a submission and a user together and needs both or
 * neither. This touches one row, so a single statement is already atomic and
 * a function would be ceremony.
 */

interface Row {
  id: string;
  venue_id: string;
  user_id: string;
  note: string | null;
  contact: string | null;
  created_at: string;
  venues: {
    name: string;
    category: string;
    state: string | null;
    phone: string | null;
    website: string | null;
    image_url: string | null;
  } | null;
  users: { name: string | null; email: string; avatar_url: string | null } | null;
}

export default function AdminVenueClaims() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("venue_owners")
      .select(
        "id, venue_id, user_id, note, contact, created_at, venues(name, category, state, phone, website, image_url), users(name, email, avatar_url)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(row: Row, approve: boolean) {
    setBusy(row.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("venue_owners")
      .update({
        status: approve ? "approved" : "rejected",
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
      })
      .eq("id", row.id);
    setBusy(null);

    if (error) {
      // The one-approved-per-venue index is the collision worth naming: two
      // people claimed the same venue and somebody already won.
      toast.error(
        /duplicate|unique/i.test(error.message)
          ? "Someone else already runs this venue."
          : error.message
      );
      return;
    }
    toast.success(approve ? "Approved" : "Rejected");
    setRows((r) => r.filter((x) => x.id !== row.id));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading claims…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-white/10">
        <p className="text-3xl">🔑</p>
        <p className="mt-3 font-bold text-gray-900 dark:text-white">
          No claims waiting
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Venue owners who claim their listing show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/venues/${r.venue_id}`}
                target="_blank"
                className="text-[16px] font-extrabold text-gray-900 hover:underline dark:text-white"
              >
                {r.venues?.name ?? "Venue"}
              </Link>
              <p className="mt-0.5 text-[13px] text-gray-500">
                {r.venues?.category}
                {r.venues?.state ? ` · ${r.venues.state}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-gray-400">
              {new Date(r.created_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <Avatar
              name={r.users?.name ?? null}
              url={r.users?.avatar_url ?? null}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">
                {r.users?.name ?? "Someone"}
              </p>
              <p className="truncate text-[12px] text-gray-500">
                {r.users?.email}
              </p>
            </div>
          </div>

          {/* The evidence, and the listing it has to match. Side by side
              because comparing them IS the review, and a screen that made
              you open another tab to do it would quietly stop being used. */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Fact label="They gave" value={r.contact ?? "nothing"} strong />
            <Fact
              label="On the listing"
              value={r.venues?.phone ?? r.venues?.website ?? "nothing to match"}
            />
          </div>

          {r.note && (
            <p className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-[13px] leading-snug text-gray-700 dark:bg-white/5 dark:text-white/70">
              {r.note}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => decide(r, false)}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-red-300 hover:text-red-700 disabled:opacity-50 dark:border-white/20 dark:text-white/80"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => decide(r, true)}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {busy === r.id ? "…" : "They run it"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Fact({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-2.5 dark:border-white/10">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
        {label}
      </p>
      <p
        className={`mt-0.5 flex items-center gap-1.5 break-all text-[13px] ${
          strong
            ? "font-bold text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-white/60"
        }`}
      >
        {strong && (
          <LineIcon name="shield" size={12} className="shrink-0 text-gray-400" />
        )}
        {value}
      </p>
    </div>
  );
}
