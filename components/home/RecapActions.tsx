"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";
import Avatar from "../Avatar";

/**
 * Like, comment and share on a recap clip.
 *
 * Counts are readable by everyone, including logged-out visitors — this shelf
 * exists to convince someone who hasn't signed up, and engagement they can't
 * see convinces nobody. Acting requires an account, and tapping while logged
 * out says so plainly rather than failing silently.
 *
 * Counts follow the same rule as the rest of the app: a zero is not worth
 * saying, so it renders as a bare icon instead of "0".
 */

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  users: { name: string | null; avatar_url: string | null } | null;
}

export default function RecapActions({
  recapId,
  eventId,
  eventTitle,
}: {
  recapId: string;
  eventId?: string | null;
  eventTitle?: string | null;
}) {
  const supabase = createClient();
  const [me, setMe] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMe(user?.id ?? null);

    const [likeRows, commentCount] = await Promise.all([
      supabase.from("recap_likes").select("user_id").eq("recap_id", recapId),
      supabase
        .from("recap_comments")
        .select("*", { count: "exact", head: true })
        .eq("recap_id", recapId),
    ]);

    // A failed read leaves the counts alone rather than showing a confident
    // zero — "nobody liked this" and "we couldn't check" are different things.
    if (!likeRows.error) {
      const rows = likeRows.data ?? [];
      setLikes(rows.length);
      setLiked(!!user && rows.some((r) => r.user_id === user.id));
    }
    if (!commentCount.error) setCount(commentCount.count ?? 0);
  }, [supabase, recapId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLike() {
    if (!me) {
      toast.error("Log in to like this.");
      return;
    }
    // Optimistic — a like that waits for the network feels broken.
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));

    const { error } = next
      ? await supabase
          .from("recap_likes")
          .insert({ recap_id: recapId, user_id: me })
      : await supabase
          .from("recap_likes")
          .delete()
          .eq("recap_id", recapId)
          .eq("user_id", me);

    if (error) {
      // Put it back. Showing a like that didn't save is how a count drifts
      // away from the truth and never comes back.
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast.error("Couldn't save that. Try again.");
    }
  }

  const openComments = useCallback(async () => {
    setOpen(true);
    const { data, error } = await supabase
      .from("recap_comments")
      .select("id, body, created_at, user_id, users(name, avatar_url)")
      .eq("recap_id", recapId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Couldn't load comments.");
      setComments([]);
      return;
    }
    setComments((data ?? []) as unknown as CommentRow[]);
  }, [supabase, recapId]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!me) {
      toast.error("Log in to comment.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase
      .from("recap_comments")
      .insert({ recap_id: recapId, user_id: me, body })
      .select("id, body, created_at, user_id, users(name, avatar_url)")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((c) => [data as unknown as CommentRow, ...(c ?? [])]);
    setCount((n) => n + 1);
    setDraft("");
  }

  async function removeComment(c: CommentRow) {
    const { error } = await supabase
      .from("recap_comments")
      .delete()
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    setComments((list) => (list ?? []).filter((x) => x.id !== c.id));
    setCount((n) => Math.max(0, n - 1));
  }

  async function share() {
    const url = eventId
      ? `${window.location.origin}/events/${eventId}`
      : window.location.origin;
    const text = eventTitle
      ? `${eventTitle} on LinkUpNaija`
      : "This happened on LinkUpNaija";
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // A cancelled share sheet throws too — say nothing rather than
      // reporting an error for something the person chose to do.
    }
  }

  return (
    <>
      <div className="pointer-events-auto flex flex-col items-center gap-4">
        <Action
          onClick={toggleLike}
          label={liked ? "Unlike" : "Like"}
          icon="heart"
          active={liked}
          // Zero is not worth saying — same rule as the rest of the app.
          count={likes}
        />
        <Action
          onClick={openComments}
          label="Comments"
          icon="chat"
          count={count}
        />
        <Action onClick={share} label="Share" icon="share" />
      </div>

      {open && (
        <div
          // FIXED, not absolute. This component is mounted inside the player's
          // small action rail (`absolute bottom-28 right-4`), so `inset-0`
          // resolved against a ~44px box and the whole sheet rendered clipped
          // into the corner — open, but effectively invisible.
          //
          // z above the player's own 100, and pointer-events-auto because the
          // rail's wrapper turns them off.
          className="pointer-events-auto fixed inset-0 z-[110] flex flex-col justify-end bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[70%] rounded-t-3xl bg-white dark:bg-[#1A1040]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-white/10">
              <p className="font-extrabold text-gray-900 dark:text-white">
                {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comments"}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close comments"
                className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white"
              >
                <LineIcon name="chevronDown" size={16} />
              </button>
            </div>

            <div className="max-h-[46vh] space-y-3 overflow-y-auto px-5 py-4">
              {comments === null ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No comments yet — say something.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    {/* A comment is the one place on this shelf you meet
                        somebody new, so their name and face go where you'd
                        expect: to them. The player is portalled over the whole
                        page, so opening a profile has to close it first,
                        otherwise you navigate underneath an overlay that's
                        still covering the screen. */}
                    <Link
                      href={`/u/${c.user_id}`}
                      onClick={() => setOpen(false)}
                      className="shrink-0"
                      aria-label={`Open ${c.users?.name ?? "this member"}'s profile`}
                    >
                      <Avatar
                        name={c.users?.name ?? null}
                        url={c.users?.avatar_url ?? null}
                        size="sm"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/u/${c.user_id}`}
                        onClick={() => setOpen(false)}
                        className="text-xs font-bold text-gray-900 hover:underline dark:text-white"
                      >
                        {c.users?.name ?? "Someone"}
                      </Link>
                      <p className="text-sm leading-snug text-gray-700 dark:text-white/80">
                        {c.body}
                      </p>
                    </div>
                    {me === c.user_id && (
                      <button
                        type="button"
                        onClick={() => removeComment(c)}
                        aria-label="Delete comment"
                        className="shrink-0 text-gray-300 hover:text-red-500"
                      >
                        <LineIcon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-white/10">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                maxLength={500}
                placeholder={me ? "Add a comment…" : "Log in to comment"}
                disabled={!me}
                className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
              <button
                type="button"
                onClick={send}
                disabled={!me || !draft.trim() || sending}
                aria-label="Post comment"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40"
              >
                <LineIcon name="send" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Action({
  onClick,
  label,
  icon,
  count,
  active = false,
}: {
  onClick: () => void;
  label: string;
  icon: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center gap-1 text-white"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur-sm transition active:scale-90 ${
          active ? "bg-red-500 text-white" : "bg-black/45"
        }`}
      >
        <LineIcon name={icon} size={20} />
      </span>
      {/* Nothing rather than "0" — a zero here is a reason not to bother. */}
      {!!count && count > 0 && (
        <span className="text-[11px] font-bold tabular-nums drop-shadow">
          {count}
        </span>
      )}
    </button>
  );
}
