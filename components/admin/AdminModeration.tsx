"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { ModerationStatus } from "@/lib/types";

export interface ModUserRow {
  id: string;
  name: string | null;
  email: string;
  moderation_status: ModerationStatus;
  warning_count: number;
  moderation_reason: string | null;
}

export interface ModEventRow {
  id: string;
  title: string;
  category: string;
  state: string;
  created_at: string;
  host: { id: string; name: string | null } | null;
}

const STATUS_CHIP: Record<ModerationStatus, string> = {
  active: "bg-green-100 text-green-700",
  warned: "bg-amber-100 text-amber-700",
  restricted: "bg-orange-100 text-orange-700",
  blocked: "bg-red-100 text-red-700",
};

export default function AdminModeration({
  users: initialUsers,
  events: initialEvents,
}: {
  users: ModUserRow[];
  events: ModEventRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [events, setEvents] = useState(initialEvents);
  const [userQuery, setUserQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function moderate(u: ModUserRow, action: "warn" | "restrict" | "block" | "clear") {
    const labels = {
      warn: "Warn",
      restrict: "Restrict",
      block: "Block",
      clear: "Clear flags for",
    };
    const reason =
      action === "clear"
        ? null
        : window.prompt(
            `${labels[action]} ${u.name ?? u.email} — reason (sent to the user):`,
            "Spam or misleading event listings"
          );
    if (action !== "clear" && reason === null) return; // cancelled
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_moderate_user", {
      p_user: u.id,
      p_action: action,
      p_reason: reason || null,
    });
    if (error) toast.error(error.message);
    else {
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                moderation_status:
                  action === "warn"
                    ? x.moderation_status === "active"
                      ? "warned"
                      : x.moderation_status
                    : action === "clear"
                      ? "active"
                      : action === "restrict"
                        ? "restricted"
                        : "blocked",
                warning_count: action === "warn" ? x.warning_count + 1 : x.warning_count,
                moderation_reason: action === "clear" ? null : reason || null,
              }
            : x
        )
      );
      toast.success(
        action === "clear" ? "Flags cleared ✅" : `User ${action === "warn" ? "warned" : action + "ed"} — they've been notified.`
      );
      router.refresh();
    }
    setBusy(null);
  }

  async function deleteEvent(e: ModEventRow) {
    const reason = window.prompt(
      `Delete "${e.title}" — reason (sent to the host):`,
      "This event violates our terms of service"
    );
    if (reason === null) return; // cancelled
    if (!window.confirm(`Permanently delete "${e.title}"? This cannot be undone.`)) return;
    setBusy(e.id);
    const { error } = await supabase.rpc("admin_delete_event", {
      p_event: e.id,
      p_reason: reason || null,
    });
    if (error) toast.error(error.message);
    else {
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
      toast.success("Event deleted — host notified.");
      router.refresh();
    }
    setBusy(null);
  }

  const uq = userQuery.trim().toLowerCase();
  const shownUsers = (
    uq
      ? users.filter(
          (u) => (u.name ?? "").toLowerCase().includes(uq) || u.email.toLowerCase().includes(uq)
        )
      : // With no search, surface flagged users first so problems are visible.
        [...users].sort(
          (a, b) =>
            (a.moderation_status === "active" ? 1 : 0) - (b.moderation_status === "active" ? 1 : 0)
        )
  ).slice(0, 8);

  const eq = eventQuery.trim().toLowerCase();
  const shownEvents = (
    eq
      ? events.filter(
          (e) =>
            e.title.toLowerCase().includes(eq) ||
            (e.host?.name ?? "").toLowerCase().includes(eq)
        )
      : events
  ).slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Users */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-gray-900">Users</p>
        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="input mt-2 w-full"
        />
        <ul className="mt-3 divide-y divide-gray-50">
          {shownUsers.length === 0 && (
            <li className="py-6 text-center text-sm text-gray-400">No users match.</li>
          )}
          {shownUsers.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/u/${u.id}`} className="text-sm font-semibold text-gray-900 hover:text-brand">
                    {u.name ?? "Unnamed"}
                  </Link>
                  <p className="truncate text-xs text-gray-500">{u.email}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CHIP[u.moderation_status] ?? STATUS_CHIP.active}`}
                  title={u.moderation_reason ?? undefined}
                >
                  {u.moderation_status}
                  {u.warning_count > 0 && ` · ${u.warning_count}⚠`}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ModBtn label="⚠ Warn" disabled={busy === u.id} onClick={() => moderate(u, "warn")} />
                <ModBtn
                  label="🚫 Restrict"
                  disabled={busy === u.id || u.moderation_status === "restricted"}
                  onClick={() => moderate(u, "restrict")}
                />
                <ModBtn
                  label="⛔ Block"
                  danger
                  disabled={busy === u.id || u.moderation_status === "blocked"}
                  onClick={() => moderate(u, "block")}
                />
                {u.moderation_status !== "active" && (
                  <ModBtn label="✅ Clear" disabled={busy === u.id} onClick={() => moderate(u, "clear")} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Events */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
        <p className="text-sm font-bold text-gray-900">Events</p>
        <input
          value={eventQuery}
          onChange={(e) => setEventQuery(e.target.value)}
          placeholder="Search by title or host…"
          className="input mt-2 w-full"
        />
        <ul className="mt-3 divide-y divide-gray-50">
          {shownEvents.length === 0 && (
            <li className="py-6 text-center text-sm text-gray-400">No events match.</li>
          )}
          {shownEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link href={`/events/${e.id}`} className="block truncate text-sm font-semibold text-gray-900 hover:text-brand">
                  {e.title}
                </Link>
                <p className="truncate text-xs text-gray-500">
                  {e.host?.name ?? "Unknown host"} · {e.category} · {e.state}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === e.id}
                onClick={() => deleteEvent(e)}
                className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                🗑 Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ModBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${
        danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
