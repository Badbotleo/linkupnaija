"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function SafetySettings({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string | null; phone: string | null };
}) {
  const supabase = createClient();
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        emergency_contact_name: name.trim() || null,
        emergency_contact_phone: phone.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error("Couldn't save. Try again.");
    else toast.success("Emergency contact saved ✅");
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        🛟 Safety
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Add an emergency contact. It pre-fills &quot;Share my plans&quot; when
        you attend events, so someone you trust always knows where you are.
      </p>

      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ec_name" className="label">
            Contact name
          </label>
          <input
            id="ec_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mum, or a close friend"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="ec_phone" className="label">
            Contact phone
          </label>
          <input
            id="ec_phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080..."
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save emergency contact"}
          </button>
        </div>
      </form>
    </div>
  );
}
