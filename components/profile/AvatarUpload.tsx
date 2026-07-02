"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { toast } from "@/lib/toast";

export default function AvatarUpload({
  userId,
  name,
  initialUrl,
  editable,
}: {
  userId: string;
  name: string | null;
  initialUrl: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const initial = (name ?? "?").charAt(0).toUpperCase();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    // Avatars only ever render small — resize hard before upload.
    const optimized = await compressImage(file, { maxDimension: 512, quality: 0.85 });
    const path = `${userId}/avatar-${Date.now()}.jpg`;
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
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    setBusy(false);
    if (error) toast.error("Couldn't save photo.");
    else {
      setUrl(publicUrl);
      toast.success("Photo updated ✨");
      router.refresh();
    }
  }

  const inner = url ? (
    <Image
      src={url}
      alt={name ?? "Profile photo"}
      width={80}
      height={80}
      className="h-20 w-20 rounded-full object-cover"
    />
  ) : (
    <span className="grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl font-bold text-white" aria-hidden>
      {initial}
    </span>
  );

  if (!editable) {
    return <div className="rounded-full border-4 border-white bg-white shadow-sm">{inner}</div>;
  }

  return (
    <label className="group relative block cursor-pointer rounded-full border-4 border-white bg-white shadow-sm">
      {inner}
      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </span>
      {busy && (
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-xs font-semibold text-white">
          …
        </span>
      )}
      <input type="file" accept="image/*" onChange={onPick} className="hidden" disabled={busy} />
    </label>
  );
}
