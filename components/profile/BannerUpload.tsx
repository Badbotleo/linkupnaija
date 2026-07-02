"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";

export default function BannerUpload({
  userId,
  initialUrl,
  editable,
}: {
  userId: string;
  initialUrl: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const optimized = await compressImage(file, { maxDimension: 1600, quality: 0.82 });
    const path = `${userId}/banner-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, optimized, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      toast.error("Upload failed. Try again.");
      setBusy(false);
      return;
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase
      .from("users")
      .update({ banner_url: publicUrl })
      .eq("id", userId);
    setBusy(false);
    if (error) toast.error("Couldn't save banner.");
    else {
      setUrl(publicUrl);
      toast.success("Banner updated ✨");
      router.refresh();
    }
  }

  const media = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Profile banner" className="h-full w-full object-cover" />
  ) : (
    <div className="h-full w-full" style={{ background: "linear-gradient(120deg,#1A1040,#534AB7)" }} />
  );

  if (!editable) {
    return <div className="relative h-36 w-full overflow-hidden sm:h-52">{media}</div>;
  }

  // The whole banner is a clickable file picker. The top portion stays above
  // the avatar/profile block so clicks are never intercepted by the overlap.
  return (
    <label className="group relative block h-36 w-full cursor-pointer overflow-hidden sm:h-52">
      {media}
      <span className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition group-hover:bg-black/60">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {busy ? "Uploading…" : url ? "Change banner" : "Add banner"}
      </span>
      <input type="file" accept="image/*" onChange={onPick} className="hidden" disabled={busy} />
    </label>
  );
}
