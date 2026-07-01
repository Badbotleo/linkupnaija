"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function SafetyCheckinButton({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function checkIn() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("safety_checkins").upsert(
      {
        user_id: user.id,
        event_id: eventId,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" }
    );
    setBusy(false);
    if (error) toast.error("Couldn't check in. Try again.");
    else {
      setDone(true);
      toast.success("Glad you're safe! ✅");
    }
  }

  if (done) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-2.5 text-center text-sm font-semibold text-green-700">
        ✅ Checked in safe
      </p>
    );
  }

  return (
    <button type="button" onClick={checkIn} disabled={busy} className="btn-outline w-full">
      {busy ? "…" : "✅ I'm safe — check in"}
    </button>
  );
}
