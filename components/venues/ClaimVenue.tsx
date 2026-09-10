"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * "I run this place."
 *
 * A claim is a request and nothing more. It lands as pending, RLS refuses any
 * other status on insert, and only an admin can move it — so the worst a
 * false claim can do is waste somebody's time reading it.
 *
 * The two fields are what a human actually needs to decide. The note is their
 * case; the contact is something we can check against the listing, a work
 * email on the venue's domain or the phone already printed on the page. We do
 * not verify either automatically, and pretending otherwise would be worse
 * than asking.
 */
export default function ClaimVenue({
  venueId,
  venueName,
  isLoggedIn,
  onClose,
  onSent,
}: {
  venueId: string;
  venueName: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function submit() {
    if (busy || !contact.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Log in first, so we know who is asking.");
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("venue_owners").insert({
      venue_id: venueId,
      user_id: user.id,
      note: note.trim() || null,
      contact: contact.trim(),
    });
    setBusy(false);
    if (err) {
      // The partial unique index is the common one, and "duplicate key" is
      // not something to show a restaurant owner.
      setError(
        /duplicate|unique/i.test(err.message)
          ? "You have already asked for this one. We are still looking at it."
          : /row-level security/i.test(err.message)
            ? "Log in first, so we know who is asking."
            : err.message
      );
      return;
    }
    onSent();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Claim ${venueName}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl dark:bg-[#1a1a1a]"
      >
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">
          Claim {venueName}
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-gray-500 dark:text-white/60">
          Tell us who you are. We check by hand, so this is read by a person.
        </p>

        {!isLoggedIn && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-800">
            You will need to{" "}
            <Link href="/login" className="underline">
              log in
            </Link>{" "}
            first.
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-gray-500">
            A work email or the phone on the listing
          </span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@theplace.com"
            className="input"
            autoComplete="off"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-gray-500">
            Anything else? (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="I am the manager. We have been open since 2019."
            className="input resize-none"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-[15px] font-bold text-gray-700 dark:border-white/20 dark:text-white/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !contact.trim() || !isLoggedIn}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send claim"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
