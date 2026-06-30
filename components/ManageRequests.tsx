"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import SocialLinks from "./SocialLinks";
import VerifiedBadge from "./VerifiedBadge";
import AttendeeProfileModal from "./AttendeeProfileModal";
import { hasSocialLinks } from "@/lib/social";
import { confettiGold } from "@/lib/confetti";
import type { RsvpWithProfile } from "@/lib/types";

export default function ManageRequests({
  initialRequests,
}: {
  initialRequests: RsvpWithProfile[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [requests, setRequests] = useState<RsvpWithProfile[]>(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const accepted = requests.filter((r) => r.status === "accepted");
  const declined = requests.filter((r) => r.status === "declined");

  // For "attend with a friend": map a user to their companion's name.
  const nameById = new Map(
    requests.map((r) => [r.user_id, r.users?.name ?? "a friend"])
  );

  async function setStatus(id: string, status: "accepted" | "declined") {
    setBusyId(id);
    setError(null);
    const { error } = await supabase
      .from("rsvps")
      .update({ status })
      .eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      if (status === "accepted") confettiGold();
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      router.refresh();
    }
    setBusyId(null);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-gray-900">
        🛂 Manage requests
        {pending.length > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            {pending.length} pending
          </span>
        )}
      </h2>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Pending */}
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No pending requests.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.user_id)}
                    aria-label={`View ${r.users?.name ?? "member"}'s profile`}
                    className="rounded-full transition hover:opacity-80"
                  >
                    <Avatar
                      name={r.users?.name ?? null}
                      url={r.users?.avatar_url ?? null}
                      size="md"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(r.user_id)}
                        className="font-bold text-gray-900 hover:text-brand hover:underline"
                      >
                        {r.users?.name ?? "Member"}
                      </button>
                      {r.users && hasSocialLinks(r.users) && <VerifiedBadge />}
                      {r.companion_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">
                          🤝 with {nameById.get(r.companion_id) ?? "a friend"}
                        </span>
                      )}
                    </div>
                    {(r.users?.state || r.users?.gender) && (
                      <p className="text-sm capitalize text-gray-500">
                        {[
                          r.users?.state && `📍 ${r.users.state}`,
                          r.users?.gender &&
                            r.users.gender !== "prefer not to say" &&
                            r.users.gender,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {r.users?.bio && (
                      <p className="mt-1.5 text-sm text-gray-600">
                        {r.users.bio}
                      </p>
                    )}
                    {r.users && <SocialLinks profile={r.users} className="mt-2" />}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "accepted")}
                    disabled={busyId === r.id}
                    className="btn-primary flex-1 py-2"
                  >
                    {busyId === r.id ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "declined")}
                    disabled={busyId === r.id}
                    className="btn flex-1 border border-red-200 bg-white py-2 text-red-600 hover:bg-red-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Accepted */}
      <CompactList
        title={`Accepted (${accepted.length})`}
        rows={accepted}
        tone="green"
        emptyText="No one accepted yet."
        onSelect={setOpenId}
      />

      {/* Declined */}
      <CompactList
        title={`Declined (${declined.length})`}
        rows={declined}
        tone="red"
        emptyText="No declined requests."
        onSelect={setOpenId}
      />

      {openId && (
        <AttendeeProfileModal userId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function CompactList({
  title,
  rows,
  tone,
  emptyText,
  onSelect,
}: {
  title: string;
  rows: RsvpWithProfile[];
  tone: "green" | "red";
  emptyText: string;
  onSelect: (userId: string) => void;
}) {
  const dot = tone === "green" ? "bg-green-500" : "bg-red-400";
  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.user_id)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-gray-50"
              >
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <Avatar
                  name={r.users?.name ?? null}
                  url={r.users?.avatar_url ?? null}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700">
                  {r.users?.name ?? "Member"}
                </span>
                {r.users && hasSocialLinks(r.users) && <VerifiedBadge />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
