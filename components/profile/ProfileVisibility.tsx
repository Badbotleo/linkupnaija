"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Who gets to read your profile.
 *
 * NOT A PREMIUM FEATURE, DELIBERATELY. It was floated as one, and the
 * reasoning against is worth keeping next to the code: this platform puts
 * strangers in the same room in the evening, and the people most likely to
 * want their bio, socials and last-seen hidden are the ones with the most to
 * lose by them being visible. Charging for that means the members who most
 * need it are the least likely to have it. Every platform that offers a
 * private account offers it free, and the first time somebody is harmed by
 * a detail they could not hide without paying, the fee is the story.
 *
 * Premium has plenty of room elsewhere: who viewed you, a verified mark,
 * boosts. Safety is not the place to put a paywall.
 *
 * WHAT PRIVATE ACTUALLY DOES. A stranger opening the profile gets a name, a
 * photo, a state and a button to connect. Everything else is withheld: bio,
 * socials, rating, badges, friend count, what they are going to, what they
 * have hosted, their posts and their past events. An accepted connection
 * sees all of it, because the connection is the permission.
 *
 * It does not erase them from the app. They still appear on the guest list
 * of an event they joined and in circles they post in, because those are
 * places they chose to be.
 */
export default function ProfileVisibility({
  initial,
  friendCount,
}: {
  initial: "public" | "private";
  /**
   * Shown with the private option, because "connections only" means
   * something very different at 2 connections than at 200 and nobody
   * should have to find that out afterwards.
   */
  friendCount: number;
}) {
  const supabase = createClient();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function choose(next: "public" | "private") {
    if (next === value || busy) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const error = user
      ? (
          await supabase
            .from("users")
            .update({ profile_visibility: next })
            .eq("id", user.id)
        ).error
      : { message: "You are not signed in." };
    setBusy(false);
    if (error) {
      // Put it back. A toggle that stays flipped after a failed write tells
      // somebody their profile is private when it is not, which is the one
      // lie this control must never tell.
      setValue(previous);
      toast.error(error.message);
      return;
    }
    toast.success(
      next === "private" ? "Your profile is now private" : "Your profile is public"
    );
  }

  return (
    <div className="space-y-2">
      <Option
        on={value === "public"}
        onPick={() => choose("public")}
        icon="users"
        title="Public"
        body="Anyone can open your profile and see your bio, your links and what you have been to."
      />
      <Option
        on={value === "private"}
        onPick={() => choose("private")}
        icon="lock"
        title="Private"
        body={
          friendCount > 0
            ? `Only your ${friendCount} connection${friendCount === 1 ? "" : "s"} see the full profile. Everyone else gets your name, photo and a button to connect.`
            : "Only people you have accepted see the full profile. You have no connections yet, so for now that is nobody."
        }
      />
    </div>
  );
}

function Option({
  on,
  onPick,
  icon,
  title,
  body,
}: {
  on: boolean;
  onPick: () => void;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={`flex w-full gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
        on
          ? "border-brand bg-brand-50/60 dark:bg-brand/20"
          : "border-gray-200 hover:border-brand/40 dark:border-white/15"
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
          on ? "border-brand bg-brand" : "border-gray-300 dark:border-white/30"
        }`}
      >
        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[15px] font-bold text-gray-900 dark:text-white">
          <LineIcon name={icon} size={14} />
          {title}
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-gray-600 dark:text-white/70">
          {body}
        </span>
      </span>
    </button>
  );
}
