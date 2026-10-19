"use client";

import { useState } from "react";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

/**
 * Two-step email verification: send a code to the account's own address,
 * then confirm it. This is what gates a payout.
 *
 * It replaced the SMS check at that gate. The code was being billed to us
 * and filtered by the networks before it reached a Nigerian number on the
 * DND list, so a host would read "verify your phone number before requesting
 * a payout", tap send, and wait for something that was never arriving. Their
 * money sat here with no way out, which is a worse outcome than any the
 * check was guarding against.
 *
 * NO ADDRESS FIELD. There is nothing to type: the code goes to the address
 * on the account. Letting somebody nominate the inbox would mean a stolen
 * session could point the code at itself, and the only thing this proves is
 * that whoever is asking can read the account's mail.
 */
export default function EmailVerify({
  email,
  alreadyVerified,
  /** Shown when a host arrives here from the payout card. */
  reason = "Confirm it's you before money leaves the platform.",
  onVerified,
}: {
  email: string | null;
  alreadyVerified: boolean;
  reason?: string;
  /**
   * So a parent gating on this can react without a round trip.
   *
   * The payout card renders this in place of its button. Without a callback
   * the card would sit there showing a green "verified" bar and no way to
   * request the payout until the host thought to reload the page.
   */
  onVerified?: () => void;
}) {
  const supabase = createClient();
  const [verified, setVerified] = useState(alreadyVerified);
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-naija-200 bg-naija-50 px-4 py-3 dark:border-naija-700/40 dark:bg-naija-900/20">
        <LineIcon name="check" size={18} className="text-naija" />
        <p className="text-sm font-semibold text-naija-700 dark:text-naija-300">
          Your email is verified
        </p>
      </div>
    );
  }

  async function sendCode() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("email-send-otp");
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? "Couldn't send code.");
      return;
    }
    const testCode = (data as { test_code?: string })?.test_code;
    if (testCode) {
      setCode(testCode);
      toast.success(`Test mode: your code is ${testCode}`);
    } else {
      toast.success(`Code sent to ${(data as { email?: string })?.email ?? "your inbox"}`);
    }
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("email-verify-otp", {
      body: { code },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? "Couldn't verify.");
      return;
    }
    setVerified(true);
    toast.success("Email verified");
    onVerified?.();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        Verify your email
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{reason}</p>

      {step === "idle" ? (
        <div className="mt-3">
          {/* The address, shown rather than asked for, so nobody sends a code
              to an inbox they stopped using and then wonders where it went. */}
          <p className="truncate rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:bg-white/[0.06] dark:text-white/80">
            {email ?? "No email on this account"}
          </p>
          <button
            type="button"
            onClick={sendCode}
            disabled={busy || !email}
            className="btn-primary mt-2 w-full py-2"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className="input flex-1 tracking-widest"
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="btn-primary shrink-0"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-brand"
          >
            Didn&apos;t arrive? Send it again
          </button>
        </div>
      )}
    </div>
  );
}
