"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { formatEventDate, formatEventTime, timeAgo } from "@/lib/format";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import EventCover from "../EventCover";
import LineIcon from "../ui/LineIcon";
import type { CirclePost, CirclePostComment } from "@/lib/types";

const POST_SELECT =
  "*, author:users!circle_posts_user_id_fkey(name, avatar_url), " +
  "event:events!circle_posts_event_id_fkey(id, title, date, time, location, state, category, cover_image_url)";

const EVENT_LINK = /\/events\/([0-9a-fA-F-]{36})/;

export default function CircleFeed({
  circleId,
  meId,
  isMember,
  isAdmin,
}: {
  circleId: string;
  meId: string | null;
  isMember: boolean;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [me, setMe] = useState<{ name: string | null; avatar_url: string | null } | null>(null);

  // Local preview for the composer, revoked when the pick changes.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("circle_posts")
      .select(POST_SELECT)
      .eq("circle_id", circleId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as unknown as CirclePost[]);

    if (meId) {
      const [{ data: likes }, { data: profile }] = await Promise.all([
        supabase.from("circle_post_likes").select("post_id").eq("user_id", meId),
        supabase.from("users").select("name, avatar_url").eq("id", meId).single(),
      ]);
      setLikedIds(new Set((likes ?? []).map((l: { post_id: string }) => l.post_id)));
      setMe(profile ?? null);
    }
  }, [circleId, meId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!meId || (!content.trim() && !imageFile)) return;
    setPosting(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      const optimized = await compressImage(imageFile, { maxDimension: 1600 });
      const path = `${meId}/post-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("event-covers")
        .upload(path, optimized, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        toast.error("Image upload failed.");
        setPosting(false);
        return;
      }
      imageUrl = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
    }

    const eventMatch = content.match(EVENT_LINK);
    const { error } = await supabase.from("circle_posts").insert({
      circle_id: circleId,
      user_id: meId,
      content: content.trim() || null,
      image_url: imageUrl,
      event_id: eventMatch ? eventMatch[1] : null,
    });
    if (error) toast.error(error.message);
    else {
      setContent("");
      setImageFile(null);
      await load();
    }
    setPosting(false);
  }

  async function toggleLike(post: CirclePost) {
    if (!meId) return;
    const liked = likedIds.has(post.id);
    // optimistic
    setLikedIds((prev) => {
      const n = new Set(prev);
      if (liked) n.delete(post.id);
      else n.add(post.id);
      return n;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, like_count: p.like_count + (liked ? -1 : 1) } : p
      )
    );
    if (liked) {
      await supabase.from("circle_post_likes").delete().eq("post_id", post.id).eq("user_id", meId);
    } else {
      await supabase.from("circle_post_likes").insert({ post_id: post.id, user_id: meId });
    }
  }

  async function deletePost(id: string) {
    await supabase.from("circle_posts").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function togglePin(post: CirclePost) {
    await supabase.from("circle_posts").update({ pinned: !post.pinned }).eq("id", post.id);
    await load();
  }

  // One continuous column with hairline dividers — no floating cards, so the
  // feed reads as a single scroll the way X/Twitter does.
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {isMember && (
        <form onSubmit={submitPost} className="border-b border-gray-100 px-4 py-3">
          <div className="flex gap-3">
            <Avatar name={me?.name ?? null} url={me?.avatar_url ?? null} size="sm" />
            <div className="min-w-0 flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                placeholder="What's happening in the circle?"
                className="w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-snug text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              />

              {previewUrl && (
                <div className="relative mt-2 overflow-hidden rounded-2xl border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="" className="max-h-72 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    aria-label="Remove photo"
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/80"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
                <label
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-brand transition hover:bg-brand/10"
                  title="Add photo"
                >
                  <LineIcon name="image" size={19} />
                  <span className="sr-only">Add photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="submit"
                  disabled={posting || (!content.trim() && !imageFile)}
                  className="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-40"
                >
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {posts.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-gray-500">
          No posts yet. {isMember ? "Be the first to share something!" : "Join to start posting."}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              meId={meId}
              isAdmin={isAdmin}
              isMember={isMember}
              liked={likedIds.has(post.id)}
              onLike={() => toggleLike(post)}
              onDelete={() => deletePost(post.id)}
              onPin={() => togglePin(post)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  meId,
  isAdmin,
  isMember,
  liked,
  onLike,
  onDelete,
  onPin,
}: {
  post: CirclePost;
  meId: string | null;
  isAdmin: boolean;
  isMember: boolean;
  liked: boolean;
  onLike: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const supabase = createClient();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CirclePostComment[] | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("circle_post_comments")
      .select("*, author:users!circle_post_comments_user_id_fkey(name, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data ?? []) as unknown as CirclePostComment[]);
  }, [post.id, supabase]);

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) await loadComments();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!meId || !text.trim()) return;
    await supabase.from("circle_post_comments").insert({
      post_id: post.id,
      user_id: meId,
      parent_id: replyTo,
      content: text.trim(),
    });
    setText("");
    setReplyTo(null);
    await loadComments();
  }

  const canDelete = meId === post.user_id || isAdmin;
  const top = (comments ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id);

  const handle = (post.author?.name ?? "member").toLowerCase().replace(/[^a-z0-9]+/g, "");

  return (
    <article className="px-4 py-3 transition hover:bg-gray-50/70">
      {post.pinned && (
        <p className="mb-1.5 flex items-center gap-1.5 pl-[52px] text-xs font-semibold text-gray-500">
          <LineIcon name="pin" size={13} /> Pinned
        </p>
      )}
      <div className="flex gap-3">
        <Avatar name={post.author?.name ?? null} url={post.author?.avatar_url ?? null} size="sm" />

        <div className="min-w-0 flex-1">
          {/* Name · @handle · when — one line, like X */}
          <div className="flex items-center gap-1 text-[15px] leading-tight">
            <span className="truncate font-bold text-gray-900">
              {post.author?.name ?? "Member"}
            </span>
            <span className="truncate text-gray-500">@{handle}</span>
            <span className="text-gray-400">·</span>
            <time
              dateTime={post.created_at}
              title={formatEventDate(post.created_at.slice(0, 10))}
              className="shrink-0 text-gray-500"
            >
              {timeAgo(post.created_at)}
            </time>

            {(isAdmin || canDelete) && (
              <div className="relative ml-auto shrink-0">
                <details className="group">
                  <summary
                    className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-gray-400 transition hover:bg-brand/10 hover:text-brand"
                    aria-label="Post options"
                  >
                    <LineIcon name="more" size={17} />
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={onPin}
                        className="block w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {post.pinned ? "Unpin post" : "Pin post"}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={onDelete}
                        className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete post
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>

          {post.content && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-normal text-gray-900">
              {post.content}
            </p>
          )}

          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              className="mt-2.5 max-h-[30rem] w-full rounded-2xl border border-gray-100 object-cover"
            />
          )}

          {post.event && (
            <Link
              href={`/events/${post.event.id}`}
              className="mt-2.5 flex gap-3 overflow-hidden rounded-2xl border border-gray-100 transition hover:border-brand/40"
            >
              <EventCover
                url={post.event.cover_image_url}
                category={post.event.category ?? "Networking"}
                title={post.event.title}
                className="h-20 w-24 shrink-0"
              />
              <div className="min-w-0 py-2 pr-3">
                <p className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand">
                  Event
                </p>
                <p className="mt-1 truncate text-sm font-bold text-gray-900">{post.event.title}</p>
                <p className="truncate text-xs text-gray-500">
                  {formatEventDate(post.event.date)} · {formatEventTime(post.event.time)}
                </p>
              </div>
            </Link>
          )}

          {/* Action bar — icon in a circle that tints on hover, count beside it */}
          <div className="mt-2 flex max-w-[19rem] items-center justify-between">
            <button
              type="button"
              onClick={openComments}
              aria-expanded={showComments}
              className="group -ml-2 inline-flex items-center gap-0.5 text-gray-500 transition hover:text-brand"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full transition group-hover:bg-brand/10">
                <LineIcon name="chat" size={17} />
              </span>
              <span className="text-[13px] font-medium tabular-nums">
                {comments && comments.length > 0 ? comments.length : ""}
              </span>
            </button>

            <button
              type="button"
              onClick={onLike}
              disabled={!meId}
              aria-pressed={liked}
              aria-label={liked ? "Unlike" : "Like"}
              className={`group inline-flex items-center gap-0.5 transition disabled:opacity-50 ${
                liked ? "text-rose-600" : "text-gray-500 hover:text-rose-600"
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full transition group-hover:bg-rose-500/10">
                <LineIcon name="heart" size={17} filled={liked} />
              </span>
              <span className="text-[13px] font-medium tabular-nums">
                {post.like_count > 0 ? post.like_count : ""}
              </span>
            </button>

            <span aria-hidden className="w-8" />
          </div>

          {showComments && (
            <div className="mt-3 border-t border-gray-50 pt-3">
              {comments === null ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <ul className="space-y-3">
                  {top.map((c) => (
                    <li key={c.id}>
                      <Comment comment={c} onReply={() => setReplyTo(c.id)} />
                      {repliesOf(c.id).length > 0 && (
                        <ul className="mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                          {repliesOf(c.id).map((r) => (
                            <li key={r.id}>
                              <Comment comment={r} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isMember && meId && (
                <form onSubmit={addComment} className="mt-3 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
                    className="input flex-1 rounded-full py-2 text-sm"
                  />
                  {replyTo && (
                    <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-gray-400">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-primary rounded-full px-4 py-1.5 text-sm">
                    Send
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Comment({ comment, onReply }: { comment: CirclePostComment; onReply?: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar name={comment.author?.name ?? null} url={comment.author?.avatar_url ?? null} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-gray-50 px-3 py-2">
          <p className="text-xs font-bold text-gray-900">{comment.author?.name ?? "Member"}</p>
          <p className="text-sm text-gray-700">{comment.content}</p>
        </div>
        {onReply && (
          <button type="button" onClick={onReply} className="mt-1 text-xs font-medium text-gray-400 hover:text-brand">
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
