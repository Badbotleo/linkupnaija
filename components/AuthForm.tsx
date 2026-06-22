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

  // Success banner shown on the login page right after email verification.
  const justVerified = mode === "login" && searchParams.get("verified") === "1";

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      // After the user clicks the link in their email, send them back to the
      // login page with a success flag.
      const verifyRedirect = encodeURIComponent("/login?verified=1");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, state },
          emailRedirectTo: `${location.origin}/auth/callback?redirect=${verifyRedirect}`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is on there is no active session yet — send the
      // user to the "check your email" page. Otherwise straight to setup.
      if (data.session) {
        router.push("/profile/setup");
        router.refresh();
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // First-time login (profile not set up yet) → onboarding.
      let destination = redirect;
      if (data.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("profile_completed")
          .eq("id", data.user.id)
          .single();
        if (profile && !profile.profile_completed) {
          destination = "/profile/setup";
        }
      }
      router.push(destination);
      router.refresh();
    }
  }

  const isSignup = mode === "signup";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {justVerified && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          ✅ Email verified! Please log in.
        </p>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
      >
        <GoogleLogo />
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium uppercase text-gray-400">or</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

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

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
