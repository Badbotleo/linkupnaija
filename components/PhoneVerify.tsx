"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { checkNigerianPhone } from "@/lib/phone";

// Two-step phone verification: send an SMS code, then confirm it. On success
// the user's number shows a "Verified" badge across the app.
export default function PhoneVerify({
  initialPhone,
  alreadyVerified,
}: {
  initialPhone: string | null;
  alreadyVerified: boolean;
}) {
  const supabase = createClient();
  const [verified, setVerified] = useState(alreadyVerified);
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-naija-200 bg-naija-50 px-4 py-3">
        <span className="text-lg" aria-hidden>✅</span>
        <p className="text-sm font-semibold text-naija-700">
          Your phone number is verified
        </p>
      </div>
    );
  }

  async function sendCode() {
    // Checked here first so a typo costs nothing. An SMS to a number that
    // cannot exist is money spent to tell someone what we already knew, and
    // they wait for a code that will never arrive.
    const checked = checkNigerianPhone(phone);
    if (!checked.ok) {
      toast.error(checked.error ?? "Check that number.");
      return;
    }
    setBusy(true);
    // Send the canonical +234 form, not whatever shape they typed.
    const { data, error } = await supabase.functions.invoke("phone-send-otp", {
      body: { phone: checked.e164 },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? "Couldn't send code.");
      return;
    }
    // Test mode returns the code directly (no SMS provider configured).
    const testCode = (data as { test_code?: string })?.test_code;
    if (testCode) {
      setCode(testCode);
      toast.success(`Test mode: your code is ${testCode}`);
    } else {
      toast.success("Code sent 📲");
    }
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("phone-verify-otp", {
      body: { code },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? "Couldn't verify.");
      return;
    }
    setVerified(true);
    toast.success("Phone verified ✅");
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">
        📱 Verify your phone number
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        A verified number builds trust. Hosts approve verified guests faster.
      </p>

      {step === "idle" ? (
        <div className="mt-3 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="0801 234 5678"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={busy || !checkNigerianPhone(phone).ok}
            className="btn-primary shrink-0"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
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
            ← Change number / resend
          </button>
        </div>
      )}
    </div>
  );
}
