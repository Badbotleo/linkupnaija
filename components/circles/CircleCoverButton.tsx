"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";

/**
 * Change a circle's cover after it exists.
 *
 * The cover could only ever be set on the create form, so a circle started
 * without one was stuck with the drawn fallback forever and a circle with a
 * bad photo was stuck with that. Five of six circles had no cover, which is
 * less about taste than about there being no button.
 *
 * Creator only, deliberately. The RLS policy is "Creators update their
 * circles", so showing this to a promoted admin would give them a control
 * that silently does nothing: PostgREST answers a blocked update with zero
 * rows and no error, which is the failure that looks like a frozen app.
 */
export default function CircleCoverButton({
  circleId,
  hasCover,
}: {
  circleId: string;
  hasCover: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear immediately so choosing the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to change the cover.");
        return;
      }

      const optimized = await compressImage(file, { maxDimension: 1600 });
      const path = `${user.id}/circle-${circleId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("event-covers")
        .upload(path, optimized, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        toast.error(upErr.message || "Upload failed.");
        return;
      }

      const url = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;

      // .select() so a row comes back. Without it an update refused by RLS is
      // indistinguishable from one that worked, and the cover would appear to
      // save and then not change on refresh.
      const { data, error } = await supabase
        .from("circles")
        .update({ cover_image_url: url })
        .eq("id", circleId)
        .select("id");

      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error("Only the person who created this circle can change its cover.");
        return;
      }

      toast.success("Cover updated");
      router.refresh();
    } catch {
      toast.error("Couldn't process that picture. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-60"
      >
        <LineIcon name={busy ? "clock" : "camera"} size={14} />
        {busy ? "Uploading…" : hasCover ? "Change cover" : "Add a cover"}
      </button>
    </>
  );
}
