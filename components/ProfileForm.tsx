"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import {
  normalizeFacebook,
  normalizeInstagram,
  normalizeTwitter,
} from "@/lib/social";
import Avatar from "./Avatar";
import type { UserProfile } from "@/lib/types";

function handleOf(url: string | null): string {
  if (!url) return "";
  return url.replace(/\/+$/, "").split("/").pop() ?? "";
}

export default function ProfileForm({
  userId,
  initial,
  mode,
}: {
  userId: string;
  initial: Pick<
    UserProfile,
    | "name"
    | "state"
    | "bio"
    | "avatar_url"
    | "instagram_url"
    | "twitter_url"
    | "facebook_url"
    | "phone"
    | "gender"
  >;
  mode: "setup" | "edit";
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initial.name ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [instagram, setInstagram] = useState(handleOf(initial.instagram_url));
  const [twitter, setTwitter] = useState(handleOf(initial.twitter_url));
  const [facebook, setFacebook] = useState(initial.facebook_url ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [gender, setGender] = useState(initial.gender ?? "");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.avatar_url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!file) return initial.avatar_url;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) throw upErr;
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    return publicUrl;
  }

  async function save(completed: boolean) {
    setLoading(true);
    setError(null);
    try {
      const avatar_url = await uploadAvatar();
      const { error: updErr } = await supabase
        .from("users")
        .update({
          name: name.trim() || null,
          state: state || null,
          bio: bio.trim() || null,
          avatar_url,
          instagram_url: instagram.trim()
            ? normalizeInstagram(instagram)
            : null,
          twitter_url: twitter.trim() ? normalizeTwitter(twitter) : null,
          facebook_url: facebook.trim() ? normalizeFacebook(facebook) : null,
          phone: phone.trim() || null,
          gender: gender || null,
          profile_completed: completed,
        })
        .eq("id", userId);
      if (updErr) throw updErr;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
      className="space-y-5"
    >
      {/* Photo */}
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} url={preview} size="lg" />
        <div>
          <label className="btn-outline cursor-pointer">
            {preview ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
          </label>
          <p className="mt-1 text-xs text-gray-400">JPG or PNG, up to ~5MB.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Full name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Chidi Okeke"
          />
        </div>
        <div>
          <label htmlFor="state" className="label">
            State
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="gender" className="label">
          Gender
        </label>
        <select
          id="gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="input cursor-pointer"
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="prefer not to say">Prefer not to say</option>
        </select>
      </div>

      <div>
        <label htmlFor="bio" className="label">
          Short bio
        </label>
        <textarea
          id="bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="input resize-y"
          placeholder="Tell hosts a bit about yourself…"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="instagram" className="label">
            Instagram username
          </label>
          <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
            <span className="text-sm text-gray-400">@</span>
            <input
              id="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="w-full bg-transparent px-1 py-2.5 text-sm focus:outline-none"
              placeholder="yourhandle"
            />
          </div>
        </div>
        <div>
          <label htmlFor="twitter" className="label">
            Twitter / X username
          </label>
          <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
            <span className="text-sm text-gray-400">@</span>
            <input
              id="twitter"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="w-full bg-transparent px-1 py-2.5 text-sm focus:outline-none"
              placeholder="yourhandle"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="facebook" className="label">
            Facebook profile URL
          </label>
          <input
            id="facebook"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className="input"
            placeholder="facebook.com/yourprofile"
          />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            Phone{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="080..."
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1"
        >
          {loading
            ? "Saving…"
            : mode === "setup"
              ? "Save & continue"
              : "Save changes"}
        </button>
        {mode === "setup" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => save(true)}
            className="btn-outline"
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}
