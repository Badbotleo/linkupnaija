"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { SITE_ORIGIN } from "@/lib/qr";
import { formatEventDate, formatEventTime, timeAgo } from "@/lib/format";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import EventCover from "../EventCover";
import LineIcon from "../ui/LineIcon";
import type { CirclePost, CirclePostComment } from "@/lib/types";

// NOTE: the original post of a repost is fetched in a SECOND query rather than
// embedded. PostgREST cannot embed a self-referencing foreign key, and asking
// it to made this whole select fail — which silently broke the entire feed.
const POST_SELECT =
  "*, author:users!circle_posts_user_id_fkey(name, avatar_url), " +
  "event:events!circle_posts_event_id_fkey(id, title, date, time, location, state, category, cover_image_url)";

const ORIGINAL_SELECT =
  "id, content, image_url, video_url, created_at, user_id, repost_count, " +
  "author:users!circle_posts_user_id_fkey(name, avatar_url)";

const EVENT_LINK = /\/events\/([0-9a-fA-F-]{36})/;

// Phone clips get big fast; reject early with a clear number rather than
// letting a 200MB upload crawl and fail.
const MAX_VIDEO_MB = 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

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
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [me, setMe] = useState<{ name: string | null; avatar_url: string | null } | null>(null);

  // Local preview for the composer, revoked when the pick changes.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!mediaFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("circle_posts")
      .select(POST_SELECT)
      .eq("circle_id", circleId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("circle feed load failed:", error);
      toast.error("Couldn't load the feed.");
      return;
    }

    let rows = (data ?? []) as unknown as CirclePost[];

    // Attach the originals for any reposts, in one extra round trip.
    const originIds = Array.from(
      new Set(rows.map((p) => p.repost_of).filter(Boolean) as string[])
    );
    if (originIds.length > 0) {
      const { data: origins } = await supabase
        .from("circle_posts")
        .select(ORIGINAL_SELECT)
        .in("id", originIds);
      const byId = new Map(
        ((origins ?? []) as unknown as NonNullable<CirclePost["original"]>[]).map(
          (o) => [o.id, o]
        )
      );
      rows = rows.map((p) =>
        p.repost_of ? { ...p, original: byId.get(p.repost_of) ?? null } : p
      );
    }
    setPosts(rows);

    if (meId) {
      const [{ data: likes }, { data: profile }, { data: mine }] = await Promise.all([
        supabase.from("circle_post_likes").select("post_id").eq("user_id", meId),
        supabase.from("users").select("name, avatar_url").eq("id", meId).single(),
        supabase
          .from("circle_posts")
          .select("repost_of")
          .eq("user_id", meId)
          .not("repost_of", "is", null),
      ]);
      setLikedIds(new Set((likes ?? []).map((l: { post_id: string }) => l.post_id)));
      setMe(profile ?? null);
      setRepostedIds(
        new Set((mine ?? []).map((r: { repost_of: string }) => r.repost_of))
      );
    }
  }, [circleId, meId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!meId || (!content.trim() && !mediaFile)) return;
    setPosting(true);

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;

    if (mediaFile) {
      try {
        const isVideo = mediaFile.type.startsWith("video/");

        if (isVideo && mediaFile.size > MAX_VIDEO_BYTES) {
          toast.error(
            `That clip is ${(mediaFile.size / 1024 / 1024).toFixed(0)}MB. Keep videos under ${MAX_VIDEO_MB}MB.`
          );
          setPosting(false);
          return;
        }

        // Images get resized; videos upload as-is.
        const file = isVideo
          ? mediaFile
          : await compressImage(mediaFile, { maxDimension: 1600 });

        // Compression falls back to the original file for formats the browser
        // can't decode (HEIC from an iPhone, for one), so derive the extension
        // and content type from what we're ACTUALLY uploading — writing a HEIC
        // to a ".jpg" path stored it fine but rendered broken for everyone.
        const type = file.type || (isVideo ? "video/mp4" : "image/jpeg");
        const ext = (type.split("/")[1] || (isVideo ? "mp4" : "jpg")).replace("jpeg", "jpg");
        const path = `${meId}/post-${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("event-covers")
          .upload(path, file, {
            upsert: true,
            cacheControl: "3600",
            contentType: type,
          });
        if (upErr) {
          console.error("circle post upload failed:", upErr);
          toast.error(upErr.message || "Upload failed.");
          setPosting(false);
          return;
        }

        const url = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
        if (isVideo) videoUrl = url;
        else imageUrl = url;
      } catch (err) {
        // Without this the promise rejected and the form stayed stuck on
        // "Posting…" with no explanation.
        console.error("circle post media error:", err);
        toast.error("Couldn't process that file. Try another one.");
        setPosting(false);
        return;
      }
    }

    const eventMatch = content.match(EVENT_LINK);
    const { error } = await supabase.from("circle_posts").insert({
      circle_id: circleId,
      user_id: meId,
      content: content.trim() || null,
      image_url: imageUrl,
      video_url: videoUrl,
      event_id: eventMatch ? eventMatch[1] : null,
    });
    if (error) toast.error(error.message);
    else {
      setContent("");
      setMediaFile(null);
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

  // Repost = a new row pointing at the original, so it inherits likes,
  // comments and RLS. Reposting a repost targets the original, like X does.
  async function toggleRepost(post: CirclePost) {
    if (!meId) return;
    const targetId = post.repost_of ?? post.id;
    const on = repostedIds.has(targetId);

    setRepostedIds((prev) => {
      const n = new Set(prev);
      if (on) n.delete(targetId);
      else n.add(targetId);
      return n;
    });

    if (on) {
      await supabase
        .from("circle_posts")
        .delete()
        .eq("user_id", meId)
        .eq("repost_of", targetId);
      toast.success("Repost removed");
    } else {
      const { error } = await supabase.from("circle_posts").insert({
        circle_id: circleId,
        user_id: meId,
        repost_of: targetId,
      });
      if (error) {
        setRepostedIds((prev) => {
          const n = new Set(prev);
          n.delete(targetId);
          return n;
        });
        toast.error("Could not repost.");
        return;
      }
      toast.success("Reposted to the circle");
    }
    await load();
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
    <div className="overflow-hidden surface">
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
                  {mediaFile?.type.startsWith("video/") ? (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="max-h-72 w-full bg-black object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="max-h-72 w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaFile(null)}
                    aria-label="Remove attachment"
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/80"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
                {/* Labelled, not bare glyphs — an icon-only control here left
                    people unable to find how to attach anything at all. */}
                <div className="flex items-center gap-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-brand transition hover:bg-brand/10">
                    <LineIcon name="image" size={18} />
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-brand transition hover:bg-brand/10">
                    <LineIcon name="video" size={18} />
                    Video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={posting || (!content.trim() && !mediaFile)}
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
              circleId={circleId}
              meId={meId}
              isAdmin={isAdmin}
              isMember={isMember}
              liked={likedIds.has(post.id)}
              reposted={repostedIds.has(post.repost_of ?? post.id)}
              onLike={() => toggleLike(post)}
              onRepost={() => toggleRepost(post)}
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
  circleId,
  meId,
  isAdmin,
  isMember,
  liked,
  reposted,
  onLike,
  onRepost,
  onDelete,
  onPin,
}: {
  post: CirclePost;
  circleId: string;
  meId: string | null;
  isAdmin: boolean;
  isMember: boolean;
  liked: boolean;
  reposted: boolean;
  onLike: () => void;
  onRepost: () => void;
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

  // A repost row carries no body of its own — render the original's author and
  // content, with a "X reposted" line above, exactly like X.
  const src = post.repost_of && post.original ? post.original : post;
  const shown = {
    name: src.author?.name ?? "Member",
    avatar: src.author?.avatar_url ?? null,
    content: src.content,
    image: src.image_url,
    video: src.video_url,
    created_at: src.created_at,
  };
  const handle = shown.name.toLowerCase().replace(/[^a-z0-9]+/g, "");

  async function share() {
    const url = `${SITE_ORIGIN}/circles/${circleId}#post-${post.id}`;
    const text = shown.content?.slice(0, 120) ?? "Check out this post on LinkUpNaija";
    try {
      if (navigator.share) {
        await navigator.share({ title: "LinkUpNaija", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  }

  return (
    <article id={`post-${post.id}`} className="px-4 py-3 transition hover:bg-gray-50/70">
      {post.pinned && (
        <p className="mb-1.5 flex items-center gap-1.5 pl-[52px] text-xs font-semibold text-gray-500">
          <LineIcon name="pin" size={13} /> Pinned
        </p>
      )}
      {post.repost_of && (
        <p className="mb-1.5 flex items-center gap-1.5 pl-[52px] text-xs font-semibold text-gray-500">
          <LineIcon name="repost" size={13} />
          {post.user_id === meId ? "You" : post.author?.name ?? "Someone"} reposted
        </p>
      )}
      <div className="flex gap-3">
        <Avatar name={shown.name} url={shown.avatar} size="sm" />

        <div className="min-w-0 flex-1">
          {/* Name · @handle · when — one line, like X */}
          <div className="flex items-center gap-1 text-[15px] leading-tight">
            <span className="truncate font-bold text-gray-900">{shown.name}</span>
            <span className="truncate text-gray-500">@{handle}</span>
            <span className="text-gray-400">·</span>
            <time
              dateTime={shown.created_at}
              title={formatEventDate(shown.created_at.slice(0, 10))}
              className="shrink-0 text-gray-500"
            >
              {timeAgo(shown.created_at)}
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

          {shown.content && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-normal text-gray-900">
              {shown.content}
            </p>
          )}

          {shown.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.image}
              alt=""
              loading="lazy"
              className="mt-2.5 max-h-[30rem] w-full rounded-2xl border border-gray-100 object-cover"
            />
          )}

          {shown.video && (
            <video
              src={shown.video}
              controls
              playsInline
              preload="metadata"
              className="mt-2.5 max-h-[30rem] w-full rounded-2xl border border-gray-100 bg-black"
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
              onClick={onRepost}
              disabled={!meId || !isMember}
              aria-pressed={reposted}
              aria-label={reposted ? "Undo repost" : "Repost"}
              title={reposted ? "Undo repost" : "Repost to this circle"}
              className={`group inline-flex items-center gap-0.5 transition disabled:opacity-50 ${
                reposted ? "text-naija-600" : "text-gray-500 hover:text-naija-600"
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full transition group-hover:bg-naija/10">
                <LineIcon name="repost" size={17} />
              </span>
              <span className="text-[13px] font-medium tabular-nums">
                {src.repost_count > 0 ? src.repost_count : ""}
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

            <button
              type="button"
              onClick={share}
              aria-label="Share post"
              title="Share"
              className="group inline-flex items-center text-gray-500 transition hover:text-brand"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full transition group-hover:bg-brand/10">
                <LineIcon name="share" size={17} />
              </span>
            </button>
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
