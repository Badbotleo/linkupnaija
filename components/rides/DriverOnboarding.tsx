"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { NIGERIAN_STATES } from "@/lib/constants";
import LineIcon from "../ui/LineIcon";
import { toast } from "@/lib/toast";

/**
 * Driver sign-up, in the order Bolt and Uber ask: who you are, then your ID,
 * then the car. Three short steps beat one long form — a twenty-field wall is
 * where applicants give up.
 *
 * Documents split across two buckets on purpose: the face and vehicle photos
 * are shown to riders and live in a public bucket, while the ID scan goes to a
 * private one that only the applicant and an admin can read. See
 * migration-drivers.sql.
 */
const ID_TYPES = ["NIN", "Driver's Licence", "Voter's Card", "Passport"];

interface Existing {
  id: string;
  status: string;
  admin_notes: string | null;
  [k: string]: unknown;
}

export default function DriverOnboarding({
  userId,
  existing,
  defaults,
}: {
  userId: string;
  existing: Existing | null;
  defaults: { full_name: string; phone: string; state: string };
}) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    full_name: (existing?.full_name as string) ?? defaults.full_name,
    phone: (existing?.phone as string) ?? defaults.phone,
    state: (existing?.state as string) ?? defaults.state,
    city: (existing?.city as string) ?? "",
    id_type: (existing?.id_type as string) ?? ID_TYPES[0],
    id_number: (existing?.id_number as string) ?? "",
    licence_expiry: (existing?.licence_expiry as string) ?? "",
    vehicle_make: (existing?.vehicle_make as string) ?? "",
    vehicle_model: (existing?.vehicle_model as string) ?? "",
    vehicle_colour: (existing?.vehicle_colour as string) ?? "",
    vehicle_year: (existing?.vehicle_year as number | null) ?? "",
    plate_number: (existing?.plate_number as string) ?? "",
    seats: (existing?.seats as number | null) ?? 4,
  });
  const [photo, setPhoto] = useState<string | null>(
    (existing?.photo_url as string) ?? null
  );
  const [idDoc, setIdDoc] = useState<string | null>(
    (existing?.id_document_url as string) ?? null
  );
  const [carPhoto, setCarPhoto] = useState<string | null>(
    (existing?.vehicle_photo_url as string) ?? null
  );

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function upload(file: File, bucket: string, kind: string) {
    let body: File | Blob = file;
    let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    try {
      body = await compressImage(file, { maxDimension: 1600 });
      ext = "jpg";
    } catch {
      // HEIC (every iPhone photo) and PDFs can't go through a canvas.
      // Upload as-is — a large ID scan beats a rejected one.
    }
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const opts = {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || undefined,
    };
    let { error: e } = await supabase.storage.from(bucket).upload(path, body, opts);
    if (e) {
      ({ error: e } = await supabase.storage.from(bucket).upload(path, body, opts));
    }
    if (e) throw new Error(`${bucket}: ${e.message}`);
    if (bucket === "driver-photos") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    // Private bucket — store the path; a signed URL is minted on demand.
    return path;
  }

  async function pick(
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: string,
    kind: string,
    onDone: (v: string) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await upload(file, bucket, kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setBusy(false);
    e.target.value = "";
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const row = {
      user_id: userId,
      full_name: f.full_name.trim(),
      phone: f.phone.trim(),
      state: f.state || null,
      city: f.city.trim() || null,
      photo_url: photo,
      id_type: f.id_type,
      id_number: f.id_number.trim() || null,
      id_document_url: idDoc,
      licence_expiry: f.licence_expiry || null,
      vehicle_make: f.vehicle_make.trim() || null,
      vehicle_model: f.vehicle_model.trim() || null,
      vehicle_colour: f.vehicle_colour.trim() || null,
      vehicle_year: f.vehicle_year ? Number(f.vehicle_year) : null,
      plate_number: f.plate_number.trim().toUpperCase() || null,
      vehicle_photo_url: carPhoto,
      seats: Number(f.seats) || 4,
    };

    const { error: e } = existing
      ? await supabase.from("drivers").update(row).eq("id", existing.id)
      : await supabase.from("drivers").insert(row);

    setBusy(false);
    if (e) {
      setError(
        /relation .*drivers.* does not exist/i.test(e.message)
          ? "Driver sign-up isn't switched on yet — the migration still needs running."
          : e.message
      );
      return;
    }
    toast.success(
      existing ? "Details updated" : "Application sent — we'll review it shortly"
    );
    router.refresh();
  }

  // ---------------------------------------------------------------- status
  if (existing && existing.status !== "rejected") {
    const s = existing.status;
    const tone =
      s === "approved"
        ? { bg: "bg-naija-50", fg: "text-naija-700", label: "Approved" }
        : s === "suspended"
          ? { bg: "bg-red-50", fg: "text-red-700", label: "Suspended" }
          : { bg: "bg-amber-50", fg: "text-amber-700", label: "Under review" };
    return (
      <div className="space-y-4">
        <div className={`surface p-5 ${tone.bg}`}>
          <p className={`text-sm font-black uppercase tracking-wide ${tone.fg}`}>
            {tone.label}
          </p>
          <p className="mt-1 text-[15px] text-gray-700">
            {s === "approved"
              ? "You're live. Ride requests near you will start coming through."
              : s === "suspended"
                ? "Your account is paused. Contact support@linkupnaija.com."
                : "We're checking your documents. This usually takes a day or two."}
          </p>
          {existing.admin_notes && (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">
              {existing.admin_notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push("/drive?edit=1")}
          className="btn-outline w-full"
        >
          Update my details
        </button>
      </div>
    );
  }

  const STEPS = ["You", "ID", "Vehicle"];
  const canNext =
    step === 0
      ? f.full_name.trim() && f.phone.trim()
      : step === 1
        ? f.id_number.trim()
        : f.plate_number.trim();

  return (
    <div>
      {/* Progress — an applicant should always know how much is left. */}
      <div className="mb-5 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-gray-200"}`}
            />
            <p
              className={`mt-1.5 text-[11px] font-bold uppercase tracking-wide ${
                i <= step ? "text-brand" : "text-gray-400"
              }`}
            >
              {s}
            </p>
          </div>
        ))}
      </div>

      {existing?.status === "rejected" && existing.admin_notes && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Previously declined: {existing.admin_notes}
        </p>
      )}

      <div className="surface space-y-4 p-5">
        {step === 0 && (
          <>
            <Photo
              label="Your photo"
              hint="Riders see this. Face clearly visible, no sunglasses."
              url={photo}
              round
              onPick={(e) => pick(e, "driver-photos", "face", setPhoto)}
            />
            <Field label="Full name">
              <input className="input" value={f.full_name}
                onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" inputMode="tel" value={f.phone}
                onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="State">
                <select className="input" value={f.state}
                  onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select…</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="City / area">
                <input className="input" value={f.city}
                  onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="ID type">
                <select className="input" value={f.id_type}
                  onChange={(e) => set("id_type", e.target.value)}>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="ID number">
                <input className="input" value={f.id_number}
                  onChange={(e) => set("id_number", e.target.value)} />
              </Field>
            </div>
            <Field label="Licence expiry (optional)">
              <input type="date" className="input" value={f.licence_expiry}
                onChange={(e) => set("licence_expiry", e.target.value)} />
            </Field>
            <Photo
              label="Photo of your ID"
              hint="Only you and our review team can see this — never riders."
              url={idDoc}
              onPick={(e) => pick(e, "driver-docs", "id", setIdDoc)}
              privateDoc
            />
            {!idDoc && (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                You can carry on without this, but we can&apos;t approve you
                until we&apos;ve seen your ID. If the upload keeps failing,
                send it to support@linkupnaija.com and we&apos;ll attach it.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Make"><input className="input" placeholder="Toyota"
                value={f.vehicle_make} onChange={(e) => set("vehicle_make", e.target.value)} /></Field>
              <Field label="Model"><input className="input" placeholder="Corolla"
                value={f.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} /></Field>
              <Field label="Colour"><input className="input" placeholder="Silver"
                value={f.vehicle_colour} onChange={(e) => set("vehicle_colour", e.target.value)} /></Field>
              <Field label="Year"><input className="input" inputMode="numeric" placeholder="2016"
                value={String(f.vehicle_year)} onChange={(e) => set("vehicle_year", e.target.value as never)} /></Field>
            </div>
            <Field label="Plate number">
              <input className="input uppercase" placeholder="ABC 123 XY"
                value={f.plate_number}
                onChange={(e) => set("plate_number", e.target.value)} />
            </Field>
            <Field label="Seats for passengers">
              <input type="number" min={1} max={7} className="input"
                value={String(f.seats)}
                onChange={(e) => set("seats", e.target.value as never)} />
            </Field>
            <Photo
              label="Photo of your car"
              hint="Riders use this to spot you at pickup."
              url={carPhoto}
              onPick={(e) => pick(e, "driver-photos", "car", setCarPhoto)}
            />
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {!canNext && (
        <p className="mt-3 text-center text-xs text-gray-500">
          {step === 0
            ? "Add your name and phone to continue."
            : step === 1
              ? !idDoc
                ? "Upload a photo of your ID to continue."
                : "Add your ID number to continue."
              : "Add your plate number to continue."}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)}
            className="btn-outline flex-1">Back</button>
        )}
        {step < 2 ? (
          <button type="button" disabled={!canNext || busy}
            onClick={() => setStep((s) => s + 1)}
            className="btn-primary flex-1 disabled:opacity-50">Continue</button>
        ) : (
          <button type="button" disabled={!canNext || busy} onClick={submit}
            className="btn-primary flex-1 disabled:opacity-50">
            {busy ? "Sending…" : existing ? "Save changes" : "Submit application"}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-gray-500">
        We verify every driver before they can accept a ride.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Photo({
  label, hint, url, onPick, round, privateDoc,
}: {
  label: string;
  hint: string;
  url: string | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  round?: boolean;
  privateDoc?: boolean;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-3 transition hover:border-brand/40">
        <span
          className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden bg-gray-100 text-gray-400 ${
            round ? "rounded-full" : "rounded-xl"
          }`}
        >
          {url && !privateDoc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : url ? (
            <LineIcon name="check" size={22} className="text-naija" />
          ) : (
            <LineIcon name="camera" size={22} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-900">
            {url ? "Uploaded — tap to replace" : "Tap to upload"}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
            {hint}
          </span>
        </span>
        <input type="file" accept="image/*" onChange={onPick} className="hidden" />
      </label>
    </div>
  );
}
