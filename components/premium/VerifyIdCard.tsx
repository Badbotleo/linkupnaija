"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Submit a government ID so the gold badge can mean something.
 *
 * The whole Premium pitch rests on this being a real check, so the flow is
 * built to be one: a document and a selfie go into a PRIVATE bucket, a person
 * on the team looks at them, and only then is the member stamped. Nothing
 * here can approve itself.
 *
 * Two things this deliberately does not do:
 *
 * It does not read the document. No OCR, no NIN lookup, nothing that would
 * have us storing an extracted identity number we have no need for and no
 * business holding. A human reads it and records a yes or a no.
 *
 * It does not show the uploaded file back as a public URL. The bucket has no
 * public read at all; even the member gets their own file only through a
 * signed URL. The commonest way this feature goes wrong is a convenience
 * preview that quietly makes somebody's ID world-readable.
 */

type Status = "none" | "pending" | "approved" | "rejected";

const DOC_TYPES = [
  { value: "nin", label: "NIN slip" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "voters_card", label: "Voter's card" },
  { value: "passport", label: "International passport" },
] as const;

const MAX_BYTES = 6 * 1024 * 1024;

export default function VerifyIdCard({
  userId,
  initialStatus,
  note,
}: {
  userId: string;
  initialStatus: Status;
  note?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [docType, setDocType] = useState<string>("nin");
  const [doc, setDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!doc) {
      setError("Add a photo of your ID first.");
      return;
    }
    if (doc.size > MAX_BYTES || (selfie && selfie.size > MAX_BYTES)) {
      setError("Each image needs to be under 6MB.");
      return;
    }
    setBusy(true);
    setError(null);

    // The path MUST start with the member's own id: the storage policy checks
    // exactly that, so anything else is rejected by the database rather than
    // landing somewhere it should not.
    const stamp = Date.now();
    const docPath = `${userId}/${stamp}-doc-${doc.name.replace(/[^\w.-]/g, "")}`;

    const { error: upErr } = await supabase.storage
      .from("id-docs")
      .upload(docPath, doc, { upsert: false });
    if (upErr) {
      setError(`Could not upload that: ${upErr.message}`);
      setBusy(false);
      return;
    }

    let selfiePath: string | null = null;
    if (selfie) {
      selfiePath = `${userId}/${stamp}-selfie-${selfie.name.replace(/[^\w.-]/g, "")}`;
      const { error: sErr } = await supabase.storage
        .from("id-docs")
        .upload(selfiePath, selfie, { upsert: false });
      // A missing selfie is not worth losing the submission over; the reviewer
      // can ask for one.
      if (sErr) selfiePath = null;
    }

    const { error: insErr } = await supabase.from("id_verifications").insert({
      user_id: userId,
      doc_type: docType,
      doc_path: docPath,
      selfie_path: selfiePath,
    });

    if (insErr) {
      setError(
        insErr.code === "23505"
          ? "You already have a submission waiting for review."
          : insErr.message
      );
      setBusy(false);
      return;
    }

    setStatus("pending");
    setBusy(false);
    router.refresh();
  }

  if (status === "approved") {
    return (
      <Shell tone="green">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
          Your ID is verified
        </p>
        <p className="mt-1 text-[14px] text-gray-600 dark:text-white/70">
          The gold badge shows beside your name while your Premium
          subscription is active.
        </p>
      </Shell>
    );
  }

  if (status === "pending") {
    return (
      <Shell tone="amber">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">
          We are checking your ID
        </p>
        <p className="mt-1 text-[14px] text-gray-600 dark:text-white/70">
          A person reviews this by hand, usually within a day. We will let you
          know either way.
        </p>
      </Shell>
    );
  }

  return (
    <Shell tone={status === "rejected" ? "red" : "brand"}>
      <p className="text-[15px] font-bold text-gray-900 dark:text-white">
        {status === "rejected" ? "That one did not pass" : "Verify your ID"}
      </p>
      {status === "rejected" && note && (
        <p className="mt-1 text-[14px] text-red-600">{note}</p>
      )}
      <p className="mt-1 text-[14px] text-gray-600 dark:text-white/70">
        A government ID and a selfie. Stored privately, read only by the person
        reviewing it, and never shown on your profile.
      </p>

      <label className="mt-3 block text-[13px] font-bold text-gray-700 dark:text-white/80">
        Which ID?
      </label>
      <select
        value={docType}
        onChange={(e) => setDocType(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
      >
        {DOC_TYPES.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <FileRow label="Photo of the ID" file={doc} onPick={setDoc} />
      <FileRow label="Selfie holding it" file={selfie} onPick={setSelfie} />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !doc}
        className="btn-primary mt-4 w-full py-3 disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send for review"}
      </button>
    </Shell>
  );
}

function Shell({
  tone,
  children,
}: {
  tone: "brand" | "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  const ring =
    tone === "green"
      ? "ring-naija/25"
      : tone === "amber"
        ? "ring-amber-400/30"
        : tone === "red"
          ? "ring-red-400/30"
          : "ring-brand/20";
  return (
    <section
      className={`rounded-2xl bg-white p-4 shadow-[var(--e1)] ring-1 ${ring} dark:bg-white/[0.04]`}
    >
      {children}
    </section>
  );
}

function FileRow({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 px-3 py-3 dark:border-white/20">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-900/[0.05] text-gray-500 dark:bg-white/10 dark:text-white/60">
        <LineIcon name="camera" size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-gray-800 dark:text-white/90">
          {label}
        </span>
        <span className="block truncate text-[12px] text-gray-500">
          {file ? file.name : "JPG or PNG, under 6MB"}
        </span>
      </span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
