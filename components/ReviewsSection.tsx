"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import type { ReviewWithReviewer } from "@/lib/types";

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} out of 5`}>
      {"★".repeat(value)}
      <span className="text-gray-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function ReviewsSection({
  eventId,
  hostId,
  currentUserId,
  canReview,
  initialReviews,
  existingReview,
  hostAvg,
  hostCount,
}: {
  eventId: string;
  hostId: string;
  currentUserId: string | null;
  canReview: boolean;
  initialReviews: ReviewWithReviewer[];
  existingReview: {
    rating: number;
    review_text: string | null;
    felt_safe?: "yes" | "no" | "somewhat" | null;
  } | null;
  hostAvg: number;
  hostCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [reviews] = useState(initialReviews);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existingReview?.review_text ?? "");
  const [feltSafe, setFeltSafe] = useState<"yes" | "no" | "somewhat" | "">(
    existingReview?.felt_safe ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || !currentUserId) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("reviews").upsert(
      {
        event_id: eventId,
        reviewer_id: currentUserId,
        host_id: hostId,
        rating,
        review_text: text.trim() || null,
        felt_safe: feltSafe || null,
      },
      { onConflict: "event_id,reviewer_id" }
    );

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Host reviews</h2>
        {hostCount > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
            <span className="text-amber-500">★</span>
            {Number(hostAvg).toFixed(1)}
            <span className="font-normal text-gray-400">
              ({hostCount} review{hostCount === 1 ? "" : "s"})
            </span>
          </span>
        )}
      </div>

      {/* Review form for eligible attendees */}
      {canReview && (
        <form
          onSubmit={submit}
          className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
        >
          <p className="text-sm font-semibold text-gray-900">
            {existingReview ? "Update your review" : "Rate your host"}
          </p>
          <div className="mt-2 flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className={
                  (hover || rating) >= n ? "text-amber-500" : "text-gray-300"
                }
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Share how the event went…"
            className="input mt-3 resize-y"
          />

          <div className="mt-3">
            <p className="text-sm font-semibold text-gray-700">
              🛟 Did you feel safe?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { v: "yes", label: "Yes" },
                  { v: "somewhat", label: "Somewhat" },
                  { v: "no", label: "No" },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setFeltSafe(o.v)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    feltSafe === o.v
                      ? "border-brand bg-brand text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {done && (
            <p className="mt-2 text-sm text-green-700">Thanks for your review! 🙏</p>
          )}
          <button
            type="submit"
            disabled={saving || !rating}
            className="btn-primary mt-3"
          >
            {saving
              ? "Saving…"
              : existingReview
                ? "Update review"
                : "Submit review"}
          </button>
        </form>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No reviews yet{canReview ? " — be the first!" : "."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={r.reviewer?.name ?? null}
                  url={r.reviewer?.avatar_url ?? null}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {r.reviewer?.name ?? "Attendee"}
                  </p>
                  <Stars value={r.rating} />
                </div>
              </div>
              {r.review_text && (
                <p className="mt-2 text-sm text-gray-600">{r.review_text}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
