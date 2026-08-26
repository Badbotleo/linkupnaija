"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";

/**
 * Set or clear any circle's cover, from the admin desk.
 *
 * The circle page has its own button, but that one is creator-only because
 * the RLS policy is. Support needs to fix a picture on a circle whose creator
 * has gone quiet, so this goes through admin_set_circle_cover(), which is
 * admin-gated in the database and touches only that one column.
 */
export default function AdminCircleCover({
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

  async function save(url: string) {
    const { data, error } = await supabase.rpc("admin_set_circle_cover", {
      p_circle: circleId,
      p_url: url,
    });
    if (error) {
      // Before the migration the function does not exist, which reads as a
      // generic failure otherwise.
      toast.error(
        /function/i.test(error.message)
          ? "Run migration-admin-circle-cover.sql to switch this on."
          : error.message
      );
      return false;
    }
    if (data === false) {
      toast.error("That circle wasn't found, or your account isn't an admin.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
      if (await save(url)) toast.success("Cover updated");
    } catch {
      toast.error("Couldn't process that picture.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    // Empty string, not null: the function maps it back to null, and the
    // circle falls back to its drawn art rather than a broken image.
    if (await save("")) toast.success("Cover cleared");
    setBusy(false);
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
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
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
      >
        <LineIcon name={busy ? "clock" : "camera"} size={13} />
        {busy ? "Saving…" : hasCover ? "Replace" : "Add cover"}
      </button>
      {hasCover && (
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="rounded-full px-2.5 py-1.5 text-xs font-bold text-gray-400 transition hover:text-red-600 disabled:opacity-60"
        >
          Clear
        </button>
      )}
    </div>
  );
}
