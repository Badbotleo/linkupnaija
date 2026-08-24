"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser } from "@/lib/webview";
import LineIcon from "../ui/LineIcon";
import AddToCalendar from "../AddToCalendar";

/**
 * Joining an event without leaving the event.
 *
 * The old path was: tap join → full page load to /login → maybe another to
 * /signup → back to the event → tap join again. Five steps and four page
 * loads for somebody who arrived from a TikTok link thirty seconds ago, and
 * every one of them a place to lose them.
 *
 * This is the same flow in one sheet. Nothing navigates until it's done.
 *
 * On auth method: Google is NOT the primary CTA inside an in-app browser.
 * TikTok, Instagram and Facebook webviews block the OAuth round trip, and
 * some Nigerian networks break it even outside them — which is why the
 * email-code path exists at all. Since most arrivals here come from a TikTok
 * link, leading with Google would put the one button that cannot work in
 * front of the people most likely to press it. So the order flips based on
 * where the person actually is.
 *
 * Portalled to <body>: the event page has overflow-hidden ancestors and iOS
 * Safari clips a fixed descendant of one. That's bitten this codebase four
 * times.
 */

type Step = "auth" | "code" | "confirm" | "done";

/** Survives the OAuth round trip, so a returning visitor lands mid-flow. */
const INTENT_KEY = "linkup:join-intent";

export interface JoinSheetEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string | null;
  price: number;
}

export default function JoinSheet({
  open,
  onClose,
  event,
  isLoggedIn,
  onJoin,
  autoConfirm = false,
}: {
  open: boolean;
  onClose: () => void;
  event: JoinSheetEvent;
  isLoggedIn: boolean;
  /** Performs the actual RSVP. Resolves to an error message, or null. */
  onJoin: () => Promise<string | null>;
  /** Host let anyone join instantly — changes the wording, not the mechanism. */
  autoConfirm?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(isLoggedIn ? "confirm" : "auth");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setInApp(isInAppBrowser()), []);
  useEffect(() => {
    if (open) setStep(isLoggedIn ? "confirm" : "auth");
  }, [open, isLoggedIn]);

  // Lock the page behind the sheet, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  async function withGoogle() {
    setBusy(true);
    setError(null);
    // Remember why they left, so the event page can reopen this sheet on the
    // way back instead of dumping them on a fresh page.
    try {
      sessionStorage.setItem(INTENT_KEY, event.id);
    } catch {}
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/events/${event.id}?join=1`,
      },
    });
    if (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function sendCode() {
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/events/${event.id}?join=1`,
      },
    });
    setBusy(false);
    if (e) setError(e.message);
    else setStep("code");
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (e) {
      setError("That code didn't work. Check it and try again.");
      setBusy(false);
      return;
    }
    // Straight into the join — the whole point is not making them tap twice.
    await doJoin();
  }

  async function doJoin() {
    setBusy(true);
    setError(null);
    const msg = await onJoin();
    setBusy(false);
    if (msg) {
      setError(msg);
      return;
    }
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {}
    setStep("done");
    router.refresh();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Join ${event.title}`}
    >
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-[#121212] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">
              {step === "done" ? "You're in" : "Join this link-up"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[17px] font-extrabold leading-tight text-gray-900 dark:text-white">
              {event.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
          >
            <LineIcon name="x" size={15} />
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
            {error}
          </p>
        )}

        {/* ---------------------------------------------------------- auth */}
        {step === "auth" && (
          <div className="mt-4">
            <p className="text-[13px] leading-snug text-gray-600 dark:text-white/70">
              One step. We need a way to tell you when the host says yes.
            </p>

            {/* Email first inside an in-app browser, because Google can't
                complete there and offering it would be a dead end. */}
            {inApp ? (
              <>
                <EmailBlock
                  email={email}
                  setEmail={setEmail}
                  busy={busy}
                  onSend={sendCode}
                />
                <p className="mt-3 text-center text-[12px] text-gray-400">
                  Google sign-in doesn&apos;t work inside{" "}
                  {"TikTok and Instagram's"} in-app browser — open in Chrome or
                  Safari if you&apos;d rather use it.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={withGoogle}
                  disabled={busy}
                  className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gray-900 px-5 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    or
                  </span>
                  <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                </div>
                <EmailBlock
                  email={email}
                  setEmail={setEmail}
                  busy={busy}
                  onSend={sendCode}
                />
              </>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------- code */}
        {step === "code" && (
          <div className="mt-4">
            <p className="text-[13px] leading-snug text-gray-600 dark:text-white/70">
              We sent a code to <span className="font-bold">{email}</span>.
              Enter it and you&apos;re in.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="input mt-3 text-center text-[20px] font-extrabold tracking-[0.3em]"
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={busy || code.trim().length < 4}
              className="mt-3 w-full rounded-2xl bg-brand px-5 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Checking…" : "Confirm and join"}
            </button>
            <button
              type="button"
              onClick={() => setStep("auth")}
              className="mt-2 w-full text-[13px] font-semibold text-gray-500"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* ------------------------------------------------------- confirm */}
        {step === "confirm" && (
          <div className="mt-4">
            <div className="rounded-2xl bg-gray-50 p-3.5 text-[13px] leading-snug text-gray-700 dark:bg-white/5 dark:text-white/80">
              {autoConfirm ? (
                <>
                  You&apos;re in the moment you tap — no waiting. The host adds
                  you to the group chat separately.
                </>
              ) : (
                <>
                  The host approves every guest, so this sends them a request.
                  You&apos;ll get a notification either way.
                </>
              )}
            </div>
            <button
              type="button"
              onClick={doJoin}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-brand px-5 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {busy
                ? "Sending…"
                : autoConfirm
                  ? "Count me in"
                  : event.price > 0
                    ? "Request to join"
                    : "Ask to join — free"}
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------- done */}
        {step === "done" && (
          <div className="mt-4">
            {/* An explicit end. The old flow just refreshed the page and left
                people wondering whether it had worked. */}
            <div className="flex items-start gap-3 rounded-2xl border border-naija/30 bg-naija-50 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-naija text-white">
                <LineIcon name="check" size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-naija-800">
                  {autoConfirm ? "You're going" : "Request sent"}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-naija-800/80">
                  {autoConfirm
                    ? // Precise on purpose. Saying "the chat is open" when it
                      // isn't yet turns a deliberate design into a bug report.
                      "Your spot is confirmed — you're going. The host will add you to the group chat shortly."
                    : "The host will get back to you. We'll notify you the moment they do."}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <AddToCalendar
                event={{
                  id: event.id,
                  title: event.title,
                  date: event.date,
                  time: event.time,
                  location: event.location ?? "",
                }}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-2xl border border-gray-200 px-5 py-3 text-[15px] font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function EmailBlock({
  email,
  setEmail,
  busy,
  onSend,
}: {
  email: string;
  setEmail: (v: string) => void;
  busy: boolean;
  onSend: () => void;
}) {
  return (
    <>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder="you@email.com"
        className="input mt-3"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={busy || !email.trim()}
        className="mt-2 w-full rounded-2xl bg-brand px-5 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Email me a code"}
      </button>
    </>
  );
}

/** Google's mark, inline so the sheet doesn't fetch anything to render. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.2-5.2C29.8 34.9 27 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.2C41.1 36.3 44 30.7 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
