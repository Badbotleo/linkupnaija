"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/events";
  const supabase = createClient();

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, state },
          emailRedirectTo: `${location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is on there is no active session yet.
      if (data.session) {
        router.push(redirect);
        router.refresh();
      } else {
        setMessage(
          "Account created! Check your email to confirm, then log in."
        );
        setLoading(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(redirect);
      router.refresh();
    }
  }

  const isSignup = mode === "signup";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignup && (
        <>
          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chidi Okeke"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="state" className="label">
              Your state
            </label>
            <select
              id="state"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input cursor-pointer"
            >
              <option value="" disabled>
                Select your state
              </option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="input"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading
          ? "Please wait…"
          : isSignup
            ? "Create account"
            : "Log in"}
      </button>

      <p className="text-center text-sm text-gray-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to LinkUpNaija?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
