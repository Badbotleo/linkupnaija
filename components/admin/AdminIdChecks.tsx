"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import Avatar from "@/components/Avatar";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Reviewing government IDs, which is the work that makes the gold badge true.
 *
 * The whole Premium proposition rests on a person looking at a document, so
 * this screen exists to make that a minute's work rather than a chore that
 * quietly stops happening.
 *
 * Documents are fetched as SIGNED URLs, created on demand and short-lived.
 * The bucket has no public read at all, so there is no URL here that would
 * still resolve if it leaked out of this screen. That matters more than
 * usual: the thing on the other end of these links is somebody's NIN.
 *
 * Approve and reject both go through admin_review_id, which stamps the
 * submission and the user together. Doing it in one database call is what
 * stops a review half-applying, leaving a member marked approved with no
 * badge or the reverse.
 */

interface Row {
  id: string;
  user_id: string;
  doc_type: string;
  doc_path: string;
  selfie_path: string | null;
  status: string;
  created_at: string;
  users: { name: string | null; email: string; avatar_url: string | null } | null;
}

const DOC_LABEL: Record<string, string> = {
  nin: "NIN slip",
  drivers_licence: "Driver's licence",
  voters_card: "Voter's card",
  passport: "Passport",
};

export default function AdminIdChecks() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("id_verifications")
      .select(
        "id, user_id, doc_type, doc_path, selfie_path, status, created_at, users(name, email, avatar_url)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /** Sixty seconds is plenty to look at a document and not much use to anyone else. */
  async function reveal(path: string) {
    if (links[path]) return;
    const { data, error } = await supabase.storage
      .from("id-docs")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open that file.");
      return;
    }
    setLinks((l) => ({ ...l, [path]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function review(row: Row, approve: boolean) {
    const note = approve
      ? null
      : window.prompt("Why is this being rejected? The member sees this.");
    // A cancelled prompt is not a rejection.
    if (!approve && note === null) return;

    setBusy(row.id);
    const { data, error } = await supabase.rpc("admin_review_id", {
      p_verification: row.id,
      p_approve: approve,
      p_note: note,
    });
    setBusy(null);

    // The RPC returns false when it refuses rather than throwing, so a silent
    // success here would mean an unreviewed member looking reviewed.
    if (error || data !== true) {
      toast.error(error?.message ?? "That did not go through.");
      return;
    }
    toast.success(approve ? "Verified" : "Rejected");
    setRows((r) => r.filter((x) => x.id !== row.id));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading ID checks…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-white/10">
        <p className="text-3xl">🪪</p>
        <p className="mt-3 font-bold text-gray-900 dark:text-white">
          Nothing waiting
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Premium members who submit an ID show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="surface p-4">
          <div className="flex items-center gap-3">
            <Avatar
              name={r.users?.name ?? null}
              url={r.users?.avatar_url ?? null}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-gray-900 dark:text-white">
                {r.users?.name ?? "Member"}
              </p>
              <p className="truncate text-xs text-gray-500">
                {r.users?.email} · {DOC_LABEL[r.doc_type] ?? r.doc_type} ·{" "}
                {new Date(r.created_at).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reveal(r.doc_path)}
              className="btn-outline inline-flex items-center gap-1.5 py-2 text-sm"
            >
              <LineIcon name="eye" size={15} />
              Open ID
            </button>
            {r.selfie_path && (
              <button
                type="button"
                onClick={() => reveal(r.selfie_path!)}
                className="btn-outline inline-flex items-center gap-1.5 py-2 text-sm"
              >
                <LineIcon name="camera" size={15} />
                Open selfie
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => review(r, true)}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-40"
            >
              {busy === r.id ? "…" : "Verify"}
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => review(r, false)}
              className="btn-outline flex-1 py-2 text-sm text-red-600 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
