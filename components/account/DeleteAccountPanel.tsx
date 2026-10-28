"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The part of the deletion page that needs a session.
 *
 * Signed out it does not nag: the page above it is the thing Google checks,
 * and somebody who has already uninstalled should be able to read what
 * deletion does without being pushed into a login form first.
 *
 * Typing the word is the confirmation. A dialog with a red button gets
 * clicked through; a word has to be read.
 */
export default function DeleteAccountPanel() {
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(user?.email ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Nothing was changed.");
        setBusy(false);
        return;
      }
      setDone(true);
      // Straight out, not to a page that would try to read a dead session.
      setTimeout(() => {
        window.location.replace("/");
      }, 2600);
    } catch {
      setError("Could not reach the server. Nothing was changed.");
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-gray-100" aria-hidden />
    );
  }

  if (done) {
    return (
      <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5">
        <h2 className="font-extrabold text-green-900">Your account is deleted</h2>
        <p className="mt-1.5 text-sm text-green-800">
          Your personal data has been removed and you have been signed out.
          Taking you back to the home page.
        </p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="font-extrabold text-gray-900">Sign in to continue</h2>
        <p className="mt-1.5 text-sm text-gray-600">
          We need to know which account to delete, so you will be asked to sign
          in first. You will come straight back here.
        </p>
        <a
          href="/login?redirect=/delete-account"
          className="btn-primary mt-4 inline-flex px-5 py-2.5 text-sm"
        >
          Sign in
        </a>
      </div>
    );
  }

  const armed = typed.trim().toUpperCase() === "DELETE";

  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
      <h2 className="font-extrabold text-red-900">Delete this account</h2>
      <p className="mt-1.5 text-sm text-red-800">
        You are signed in as <strong>{email}</strong>. This cannot be undone,
        and we cannot restore the account afterwards.
      </p>

      <label
        htmlFor="confirm-delete"
        className="mt-4 block text-sm font-semibold text-red-900"
      >
        Type DELETE to confirm
      </label>
      <input
        id="confirm-delete"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="DELETE"
        className="input mt-1.5 w-full max-w-[220px] bg-white text-sm"
      />

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={remove}
        disabled={!armed || busy}
        className="btn mt-4 bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
