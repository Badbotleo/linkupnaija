"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends } from "@/lib/friends";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import type { FriendUser } from "@/lib/types";

export default function FriendPickerButton({
  mode,
  eventId,
  eventTitle,
  buttonLabel,
  buttonClassName,
}: {
  mode: "invite" | "join";
  eventId: string;
  eventTitle: string;
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [friends, setFriends] = useState<FriendUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || friends !== null) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFriends([]);
        return;
      }
      setFriends(await fetchFriends(supabase, user.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(friend: FriendUser) {
    setBusyId(friend.id);
    try {
      if (mode === "invite") {
        const { error } = await supabase.rpc("notify_friend", {
          p_friend: friend.id,
          p_message: `wants you to join "${eventTitle}" on LinkUpNaija! 🎉`,
          p_event: eventId,
        });
        if (error) throw error;
        // Best-effort email (no-op if the Edge Function isn't deployed).
        supabase.functions
          .invoke("send-friend-invite", {
            body: { friendId: friend.id, eventId },
          })
          .catch(() => {});
        toast.success(`Invited ${friend.name ?? "your friend"} 🎉`);
        setOpen(false);
      } else {
        const { error } = await supabase.rpc("join_with_friend", {
          p_event: eventId,
          p_friend: friend.id,
        });
        if (error) throw error;
        toast.success(
          `Request sent for you and ${friend.name ?? "your friend"} 🤝`
        );
        setOpen(false);
        router.refresh();
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Something went wrong. Try again."
      );
    } finally {
      setBusyId(null);
    }
  }

  const term = query.trim().toLowerCase();
  const shown = (friends ?? []).filter(
    (f) => !term || (f.name ?? "").toLowerCase().includes(term)
  );

  const title = mode === "invite" ? "Invite a friend" : "Attend with a friend";
  const cta = mode === "invite" ? "Invite" : "Add";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? "btn-outline w-full"}
      >
        {buttonLabel}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="border-b border-gray-100 px-5 py-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your friends…"
                  className="input"
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {friends === null ? (
                  <p className="px-2 py-8 text-center text-sm text-gray-400">
                    Loading your friends…
                  </p>
                ) : friends.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      You haven&apos;t added any friends yet.
                    </p>
                    <Link
                      href="/friends"
                      onClick={() => setOpen(false)}
                      className="btn-primary mt-4"
                    >
                      Find friends
                    </Link>
                  </div>
                ) : shown.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-gray-400">
                    No friends match “{query.trim()}”.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {shown.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50"
                      >
                        <Avatar name={f.name} url={f.avatar_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-gray-900">
                            {f.name ?? "Friend"}
                          </p>
                          {f.state && (
                            <p className="truncate text-xs text-gray-500">
                              📍 {f.state}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busyId === f.id}
                          onClick={() => pick(f)}
                          className="btn-primary px-3 py-1.5 text-sm"
                        >
                          {busyId === f.id ? "…" : cta}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
