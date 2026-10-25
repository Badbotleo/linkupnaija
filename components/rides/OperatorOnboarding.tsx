"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";
import StateIcon from "@/components/ui/StateIcon";
import FileDropzone from "@/components/ui/FileDropzone";
import type { Operator } from "@/lib/types";

/**
 * A transport company putting its fleet on LinkUpNaija.
 *
 * Deliberately not the driver form with extra boxes. A company is contracted
 * with, not vetted as a person: we need the CAC number and the papers, not a
 * face photo, and the vehicles are listed after approval rather than one car
 * at a time during sign-up.
 *
 * Three steps, because a twenty-field wall is where applicants give up.
 */

const STEPS = ["Company", "Fleet", "Documents"] as const;

export default function OperatorOnboarding({
  existing,
  defaults,
}: {
  existing: Operator | null;
  defaults: { business_name: string; phone: string; state: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState(false);

  const [f, setF] = useState({
    business_name: defaults.business_name,
    contact_name: "",
    phone: defaults.phone,
    email: "",
    state: defaults.state,
    city: "",
    rc_number: "",
    tin: "",
    fleet_size: "",
    vehicle_classes: [] as string[],
    night_availability: "",
  });

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function toggleClass(c: string) {
    setF((prev) => ({
      ...prev,
      vehicle_classes: prev.vehicle_classes.includes(c)
        ? prev.vehicle_classes.filter((x) => x !== c)
        : [...prev.vehicle_classes, c],
    }));
  }

  // An existing application: show where it stands, not the form again.
  if (existing && !done) {
    const tone =
      existing.status === "approved"
        ? { cls: "border-naija-200 bg-naija-50", icon: "check" as const }
        : existing.status === "rejected"
          ? { cls: "border-red-200 bg-red-50", icon: "x" as const }
          : { cls: "border-amber-200 bg-amber-50", icon: "clock" as const };

    return (
      <div className={`rounded-2xl border p-5 ${tone.cls}`}>
        <p className="flex items-center gap-2 font-bold text-gray-900">
          <LineIcon name={tone.icon} size={17} />
          {existing.business_name}
        </p>
        <p className="mt-1 text-sm text-gray-700">
          {existing.status === "approved"
            ? "Approved. Your vehicles can be matched to rides."
            : existing.status === "rejected"
              ? "This application was not approved."
              : existing.status === "suspended"
                ? "This account is suspended. Talk to us before taking more rides."
                : "We have your application and your documents. We will be in touch."}
        </p>
        {existing.admin_notes && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-700">
            {existing.admin_notes}
          </p>
        )}
        {existing.status === "approved" && (
          <p className="mt-3 text-sm text-gray-700">
            Booking fee on each trip:{" "}
            <span className="font-bold">{existing.commission_percent}%</span>,
            paid by the rider on top of your fare.
          </p>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-naija-200 bg-naija-50 p-6 text-center">
        <StateIcon name="check" tone="good" size={44} />
        <p className="mt-3 font-bold text-gray-900">Application received</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
          We will check the documents and come back to you. Nothing is charged
          and you are not committed to anything yet.
        </p>
      </div>
    );
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!f.business_name.trim()) return setError("What is the company called?");
      if (!f.phone.trim() && !f.email.trim())
        return setError("A phone number or an email, so we can reply.");
      if (!f.state) return setError("Which state do you operate in?");
    }
    if (step === 1 && !f.fleet_size) {
      return setError("Roughly how many vehicles do you run?");
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setBusy(true);
    setError(null);

    const body = new FormData();
    body.set("business_name", f.business_name.trim());
    body.set("contact_name", f.contact_name.trim());
    body.set("phone", f.phone.trim());
    body.set("email", f.email.trim());
    body.set("state", f.state);
    body.set("city", f.city.trim());
    body.set("rc_number", f.rc_number.trim());
    body.set("tin", f.tin.trim());
    for (const file of files) body.append("files", file);

    try {
      const res = await fetch("/api/operators/apply", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not send the application.");
        toast.error(data.error || "Could not send the application.");
        return;
      }
      if (data.failed?.length) {
        toast.error(
          `Saved, but ${data.failed.join(", ")} did not upload. Email them to support@linkupnaija.com.`
        );
      } else {
        toast.success("Application sent.");
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Where you are in the form, so three steps do not feel like twenty */}
      <ol className="mb-5 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                i < step
                  ? "bg-naija-600 text-white"
                  : i === step
                    ? "bg-brand text-white"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < step ? <LineIcon name="check" size={13} /> : i + 1}
            </span>
            <span
              className={`text-xs font-bold ${
                i === step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label">Company name</label>
            <input
              value={f.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              className="input w-full"
              placeholder="As registered with CAC"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Who should we speak to?</label>
              <input
                value={f.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
                inputMode="tel"
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">State</label>
              <select
                value={f.state}
                onChange={(e) => set("state", e.target.value)}
                className="input w-full cursor-pointer"
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <input
                value={f.city}
                onChange={(e) => set("city", e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">How many vehicles?</label>
            <input
              type="number"
              min={1}
              value={f.fleet_size}
              onChange={(e) => set("fleet_size", e.target.value)}
              className="input w-full"
              placeholder="Start with what you can commit on event nights"
            />
          </div>

          <div>
            <label className="label">What do you run?</label>
            <div className="flex flex-wrap gap-2">
              {["Sedan", "SUV", "Bus", "Luxury"].map((c) => {
                const on = f.vehicle_classes.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleClass(c)}
                    aria-pressed={on}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      on
                        ? "border-brand bg-brand text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand/40"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Can you run after 10pm?</label>
            <select
              value={f.night_availability}
              onChange={(e) => set("night_availability", e.target.value)}
              className="input w-full cursor-pointer"
            >
              <option value="">Select…</option>
              <option>Yes, most nights</option>
              <option>Weekends only</option>
              <option>Not yet</option>
            </select>
            <p className="mt-1.5 text-xs text-gray-500">
              Most link-ups end late, and the ride home is the one people
              struggle to find. Nights are worth more here than a big fleet
              sitting idle midweek.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">CAC number</label>
              <input
                value={f.rc_number}
                onChange={(e) => set("rc_number", e.target.value)}
                className="input w-full"
                placeholder="RC…"
              />
            </div>
            <div>
              <label className="label">TIN</label>
              <input
                value={f.tin}
                onChange={(e) => set("tin", e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <FileDropzone
            files={files}
            onChange={setFiles}
            hint="CAC certificate, TIN, insurance, roadworthiness and vehicle licences. PDFs or clear photographs, up to 8MB each. These are private: only LinkUpNaija admins can open them, never riders."
          />

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-900">
              What happens to your money
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              You quote the fare and keep all of it. The rider pays your fare
              plus a booking fee on top, Paystack splits the payment as it is
              collected, and your share goes to your own account. We never hold
              it.
            </p>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="btn border border-gray-200 bg-white px-5 text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="btn-primary flex-1 rounded-full py-3"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn-primary flex-1 rounded-full py-3 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send application"}
          </button>
        )}
      </div>
    </div>
  );
}
