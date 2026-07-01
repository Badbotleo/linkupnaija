"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import EventCover from "../EventCover";
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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("circle_posts")
      .select(POST_SELECT)
      .eq("circle_id", circleId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as unknown as CirclePost[]);

    if (meId) {
      const { data: likes } = await supabase
        .from("circle_post_likes")
        .select("post_id")
        .eq("user_id", meId);
      setLikedIds(new Set((likes ?? []).map((l: { post_id: string }) => l.post_id)));
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

  return (
    <div>
      {isMember && (
        <form onSubmit={submitPost} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Share something with the circle… (paste a linkupnaija.com/events/… link to share an event)"
            className="input resize-y"
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="cursor-pointer text-sm font-medium text-gray-500 hover:text-brand">
              📷 {imageFile ? imageFile.name.slice(0, 18) : "Add photo"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <button type="submit" disabled={posting} className="btn-primary px-5 py-2 text-sm">
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 space-y-4">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            No posts yet — {isMember ? "be the first to share something!" : "join to start posting."}
          </p>
        ) : (
          posts.map((post) => (
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
          ))
        )}
      </div>
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

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      {post.pinned && (
        <p className="mb-2 text-xs font-bold text-brand">📌 Pinned</p>
      )}
      <div className="flex items-start gap-3">
        <Avatar name={post.author?.name ?? null} url={post.author?.avatar_url ?? null} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{post.author?.name ?? "Member"}</p>
          <p className="text-xs text-gray-400">{formatEventDate(post.created_at.slice(0, 10))}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button type="button" onClick={onPin} className="text-xs font-medium text-gray-400 hover:text-brand">
              {post.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} className="text-xs font-medium text-gray-400 hover:text-red-600">
              Delete
            </button>
          )}
        </div>
      </div>

      {post.content && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{post.content}</p>
      )}

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}

      {post.event && (
        <Link
          href={`/events/${post.event.id}`}
          className="mt-3 flex gap-3 overflow-hidden rounded-xl border border-gray-100 transition hover:border-brand/40"
        >
          <EventCover
            url={post.event.cover_image_url}
            category={post.event.category ?? "Networking"}
            title={post.event.title}
            className="h-20 w-24 shrink-0"
          />
          <div className="min-w-0 py-2 pr-3">
            <p className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand">
              🎉 Event
            </p>
            <p className="mt-1 truncate text-sm font-bold text-gray-900">{post.event.title}</p>
            <p className="truncate text-xs text-gray-500">
              📅 {formatEventDate(post.event.date)} · {formatEventTime(post.event.time)}
            </p>
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-4 border-t border-gray-50 pt-3 text-sm">
        <button
          type="button"
          onClick={onLike}
          disabled={!meId}
          className={`inline-flex items-center gap-1.5 font-semibold ${liked ? "text-brand" : "text-gray-500 hover:text-brand"}`}
        >
          {liked ? "❤️" : "🤍"} {post.like_count > 0 ? post.like_count : ""} Like
        </button>
        <button
          type="button"
          onClick={openComments}
          className="inline-flex items-center gap-1.5 font-semibold text-gray-500 hover:text-brand"
        >
          💬 Comment
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
                className="input flex-1 py-2 text-sm"
              />
              {replyTo && (
                <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-gray-400">
                  Cancel
                </button>
              )}
              <button type="submit" className="btn-primary px-3 py-1.5 text-sm">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
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
