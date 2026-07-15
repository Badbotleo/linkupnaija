"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

const REASONS = [
  "Spam or misleading",
  "Scam or fraud",
  "Inappropriate content",
  "Harassment or hate",
  "Safety concern",
  "Something else",
];

// Lets any signed-in user flag an event or a person. Writes to `reports`,
// which surfaces in the admin Moderation panel.
export default function ReportButton({
  targetType,
  targetId,
  isLoggedIn,
  label = "Report",
  className,
}: {
  targetType: "event" | "user";
  targetId: string;
  isLoggedIn: boolean;
  label?: string;
  className?: string;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to report.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't send report. Try again.");
      return;
    }
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isLoggedIn) {
            toast.error("Please log in to report.");
            return;
          }
          setOpen(true);
        }}
        className={
          className ??
          "inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-red-500"
        }
      >
        <span aria-hidden>⚑</span> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <p className="text-4xl">✅</p>
                <h2 className="mt-2 text-lg font-bold text-gray-900">
                  Thanks for flagging
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Our team will review this. You&apos;re helping keep
                  LinkUpNaija safe.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDone(false);
                    setDetails("");
                  }}
                  className="btn-primary mt-5 w-full"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900">
                  Report this {targetType}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Tell us what&apos;s wrong. Reports are anonymous to the{" "}
                  {targetType === "event" ? "host" : "person"}.
                </p>
                <label className="label mt-4">Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input cursor-pointer"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label className="label mt-3">Details (optional)</label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="input resize-y"
                  placeholder="Anything that helps us understand…"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {busy ? "Sending…" : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
