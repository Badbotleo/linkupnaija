"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

interface Prefs {
  weekly_digest_enabled: boolean;
  welcome_emails_enabled: boolean;
}

export default function EmailPreferences({
  userId,
  initial,
}: {
  userId: string;
  initial: Prefs;
}) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    const { error } = await supabase
      .from("email_preferences")
      .upsert(
        { user_id: userId, [key]: next[key] },
        { onConflict: "user_id" }
      );
    setSaving(null);
    if (error) {
      setPrefs(prefs); // revert
      toast.error("Couldn't save your preference. Try again.");
    } else {
      toast.success("Preferences updated");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
      <h2 className="text-lg font-bold text-gray-900">Email preferences</h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose which emails you&apos;d like to receive from LinkUpNaija.
      </p>

      <div className="mt-5 space-y-3">
        <Toggle
          label="Weekly digest"
          description="A roundup of events happening near you every Thursday."
          enabled={prefs.weekly_digest_enabled}
          busy={saving === "weekly_digest_enabled"}
          onChange={() => toggle("weekly_digest_enabled")}
        />
        <Toggle
          label="Tips & event suggestions"
          description="Onboarding tips, profile reminders and personalised event picks."
          enabled={prefs.welcome_emails_enabled}
          busy={saving === "welcome_emails_enabled"}
          onChange={() => toggle("welcome_emails_enabled")}
        />
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Event reminders for events you&apos;ve joined are always sent.
      </p>
    </div>
  );
}

function Toggle({
  label,
  description,
  enabled,
  busy,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-4">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={busy}
        onClick={onChange}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          enabled ? "bg-brand" : "bg-gray-300"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
