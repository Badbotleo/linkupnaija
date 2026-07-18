"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { payWithPaystack, formatNaira } from "@/lib/paystack";
import { NIGERIAN_STATES } from "@/lib/constants";
import { TOURNAMENT } from "@/lib/tournament";
import { confettiPs5 } from "@/lib/confetti";

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-white/40 focus:border-[#7F77DD] focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/40";

export default function TournamentRegistration() {
  const supabase = createClient();
  const [filled, setFilled] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    psn_id: "",
    agree: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function loadCount() {
    const { data } = await supabase.rpc("count_tournament_registrations");
    if (typeof data === "number") setFilled(data);
  }

  useEffect(() => {
    loadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFull = (filled ?? 0) >= TOURNAMENT.capacity;
  const pct = Math.min(100, Math.round(((filled ?? 0) / TOURNAMENT.capacity) * 100));

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.agree) {
      setError("Please agree to the tournament rules.");
      return;
    }
    setLoading(true);
    try {
      const result = await payWithPaystack({
        email: form.email.trim(),
        amountNaira: TOURNAMENT.regFee,
        metadata: { purpose: "fc26_tournament", name: form.name },
      });
      if (!result) {
        setLoading(false); // popup closed without paying
        return;
      }

      const { error } = await supabase.from("tournament_registrations").insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        state: form.state || null,
        psn_id: form.psn_id.trim() || null,
        payment_reference: result.reference,
        paid: true,
      });
      if (error) setError(error.message);
      else {
        confettiPs5();
        setDone(true);
        loadCount();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Registered players / progress */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-white">
            {filled === null
              ? "Loading spots…"
              : `${filled} / ${TOURNAMENT.capacity} spots filled`}
          </span>
          {isFull && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-300">
              FULL
            </span>
          )}
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#FAC775] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Form / success */}
      {done ? (
        <div className="rounded-2xl border-2 border-[#FAC775]/60 bg-[#1A1040] p-8 text-center">
          <p className="text-4xl">🎮</p>
          <h3 className="mt-3 text-xl font-extrabold text-white">
            You&apos;re on the waitlist!
          </h3>
          <p className="mt-2 text-white/70">
            We&apos;ll contact you with venue and date details.
          </p>
        </div>
      ) : isFull ? (
        <div className="rounded-2xl border-2 border-red-400/50 bg-[#1A1040] p-8 text-center">
          <h3 className="text-xl font-extrabold text-white">
            TOURNAMENT FULL
          </h3>
          <p className="mt-2 text-white/70">
            All {TOURNAMENT.capacity} spots are taken. Join the waitlist:
            follow LinkUpNaija and we&apos;ll announce any openings.
          </p>
        </div>
      ) : (
        <form
          onSubmit={register}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#1A1040] p-6"
        >
          <h3 className="text-lg font-extrabold text-white">
            Register for FC26
          </h3>

          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Full name"
            className={inputCls}
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Email"
            className={inputCls}
          />
          <input
            required
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="Phone number"
            className={inputCls}
          />
          <select
            required
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="" className="bg-[#1A1040]">
              Select your state
            </option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s} className="bg-[#1A1040]">
                {s}
              </option>
            ))}
          </select>
          <input
            required
            value={form.psn_id}
            onChange={(e) => update("psn_id", e.target.value)}
            placeholder="FC26 gamertag / PSN ID"
            className={inputCls}
          />

          <label className="flex items-start gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => update("agree", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#534AB7]"
            />
            I agree to the tournament rules
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#534AB7] to-[#7F77DD] py-3 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? "Processing…"
              : `Pay ${formatNaira(TOURNAMENT.regFee)} to Register`}
          </button>
          <p className="text-center text-xs text-white/40">
            Secure payment via Paystack. ₦50,000 pool entry is paid at the venue.
          </p>
        </form>
      )}
    </div>
  );
}
