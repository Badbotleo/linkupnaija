"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteEventButton({
  eventId,
  hasPaidAttendees,
}: {
  eventId: string;
  hasPaidAttendees: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  if (hasPaidAttendees) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="font-bold text-gray-900">Delete event</p>
        <p className="mt-1 text-sm text-red-600">
          You cannot delete this event because attendees have paid. Please
          contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <p className="font-bold text-gray-900">Danger zone</p>
      <p className="mt-1 text-sm text-gray-500">
        Deleting an event removes it for everyone and notifies attendees.
      </p>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn mt-3 border border-red-200 bg-white text-red-600 hover:bg-red-50"
      >
        Delete event
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !loading && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-4xl">⚠️</p>
            <h3 className="mt-3 text-lg font-bold text-gray-900">
              Are you sure?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This will notify all attendees and permanently delete the event,
              its requests and chat.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={del}
                disabled={loading}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={loading}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
