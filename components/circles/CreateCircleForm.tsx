"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";

export default function CreateCircleForm({ userState }: { userState: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState(userState ?? "");
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?redirect=/circles/create");
      return;
    }

    let coverUrl: string | null = null;
    if (coverFile) {
      const optimized = await compressImage(coverFile, { maxDimension: 1600 });
      const path = `${user.id}/circle-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("event-covers")
        .upload(path, optimized, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        setError(`Cover upload failed: ${upErr.message}`);
        setLoading(false);
        return;
      }
      coverUrl = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
    }

    const { data, error: rpcErr } = await supabase.rpc("create_circle", {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_category: category || null,
      p_state: state || null,
      p_cover: coverUrl,
      p_private: isPrivate,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      return;
    }
    router.push(`/circles/${data as string}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="label">Cover photo</span>
        <label
          htmlFor="cover"
          className="group relative flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-brand/40"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-3xl">🖼️</p>
              <p className="mt-1 text-sm font-medium">Tap to add a cover</p>
            </div>
          )}
          <input id="cover" type="file" accept="image/*" onChange={onPickCover} className="hidden" />
        </label>
      </div>

      <div>
        <label htmlFor="name" className="label">Circle name</label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Abuja Foodies"
          className="input"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" required value={category} onChange={(e) => setCategory(e.target.value)} className="input cursor-pointer">
            <option value="" disabled>Pick a category</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="state" className="label">State</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)} className="input cursor-pointer">
            <option value="">All of Nigeria</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="label">Description</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this circle about? Who should join?"
          className="input resize-y"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
        <span>
          <span className="block text-sm font-bold text-gray-900">Private circle</span>
          <span className="block text-xs text-gray-500">
            People must request to join and you approve them. Public circles anyone can join.
          </span>
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Creating…" : "Create circle 🎉"}
      </button>
    </form>
  );
}
