"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { isInAppBrowser } from "@/lib/webview";

// Supabase generates the emailed code, and its length is a project-level
// Auth setting — this project currently sends 8 digits. Accept the whole
// supported range rather than hard-coding one length and locking people out
// the next time that setting changes.
const OTP_MIN = 6;
const OTP_MAX = 8;

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/events";
  const refCode = searchParams.get("ref");
  const supabase = createClient();

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth"
      ? "Google sign-in didn't complete — some mobile networks block it. Try \u201cEmail me a sign-in code\u201d below."
      : null
  );

  // Success banner shown on the login page right after email verification.
  const justVerified = mode === "login" && searchParams.get("verified") === "1";

  // Google OAuth is blocked inside in-app browsers (Instagram, FB, TikTok…),
  // so warn users who opened the link there.
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isInAppBrowser()), []);

  // Email-code sign-in. The OAuth round trip has to cross accounts.google.com
  // AND the Supabase auth host; some Nigerian mobile networks (MTN especially)
  // break somewhere in that chain. This path is two plain API calls to one
  // host, with no redirect to lose.
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  async function sendCode() {
    const addr = email.trim();
    if (!addr) return;
    setOtpBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        // Signing up and signing in share this path, so let it create the user.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) setError(error.message);
    else setOtpSent(true);
    setOtpBusy(false);
  }

  async function verifyCode() {
    setOtpBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: "email",
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("expired")
          ? "That code has expired. Tap Resend for a new one."
          : "That code didn't match. Check it and try again."
      );
      setOtpBusy(false);
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  async function signInWithGoogle() {
    setError(null);
    // Must stay same-origin: the PKCE code-verifier cookie is host-only, so
    // sending the callback to a different host (www vs apex) breaks the
    // exchange. All our hosts are in the Supabase redirect allowlist.
    const base = window.location.origin.replace(/\/+$/, "");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${base}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
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
          data: refCode ? { name, state, ref_code: refCode } : { name, state },
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
        // Track activity for re-engagement emails (best-effort).
        await supabase
          .from("users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", data.user.id);
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
        <p className="rounded-lg bg-naija-50 px-3 py-2 text-sm font-medium text-naija-700">
          ✅ Email verified! Please log in.
        </p>
      )}

      {inApp && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          ⚠️ Google sign-in doesn&apos;t work inside this app&apos;s browser. Tap
          the menu (⋯) and choose <strong>Open in browser</strong> (Chrome or
          Safari), or use email below.
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

      <p className="text-center text-[12px] italic text-gray-500">
        You&apos;ll be securely redirected to Google, then brought straight back
        to LinkUpNaija ✓
      </p>

      {/* Code sign-in needs no redirect to Google at all — two plain requests,
          which is what survives a weak mobile connection. */}
      {!otpSent ? (
        <button
          type="button"
          onClick={() => setOtpMode((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          ✉️ Email me a sign-in code
        </button>
      ) : null}

      {otpMode && (
        <div className="rounded-xl border border-brand/25 bg-brand-50 p-3">
          {!otpSent ? (
            <>
              <p className="text-xs leading-relaxed text-gray-600">
                Works on any network — we email you a 6-digit code, no Google
                redirect needed.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  inputMode="email"
                  autoComplete="email"
                  className="input flex-1"
                  aria-label="Email for sign-in code"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={otpBusy || !email.trim()}
                  className="btn-primary shrink-0 px-4 disabled:opacity-50"
                >
                  {otpBusy ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-gray-600">
                We sent a sign-in code to <strong>{email}</strong>. Enter it
                below — you never need to open the link.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))}
                  placeholder="12345678"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_MAX}
                  className="input flex-1 text-center text-lg font-bold tracking-[0.3em]"
                  aria-label="Sign-in code"
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={otpBusy || otpCode.length < OTP_MIN}
                  className="btn-primary shrink-0 px-4 disabled:opacity-50"
                >
                  {otpBusy ? "…" : "Verify"}
                </button>
              </div>
              <button
                type="button"
                onClick={sendCode}
                disabled={otpBusy}
                className="mt-2 text-xs font-semibold text-brand hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            </>
          )}
        </div>
      )}

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
