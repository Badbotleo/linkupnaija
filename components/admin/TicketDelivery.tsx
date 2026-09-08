"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import LineIcon from "../ui/LineIcon";

/**
 * Delivery state for one outsourced ticket.
 *
 * Only rendered where the event's tickets come from somebody else. Where we
 * issue the QR ourselves the buyer already has it the instant they pay, and a
 * control asking whether that happened would be a box nobody can meaningfully
 * tick.
 *
 * Both writes go through admin_* functions rather than a table update, so the
 * only fields reachable from this screen are the delivery ones. The amount on
 * a payment is never editable from an admin page by accident.
 */
export default function TicketDelivery({
  txId,
  eventId,
  delivered,
  outsourced,
  note,
  fileName,
  hasFile = false,
}: {
  txId: string;
  eventId: string | null;
  delivered: boolean;
  outsourced: boolean;
  note: string | null;
  /** What the buyer downloads it as. */
  fileName?: string | null;
  hasFile?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Attach the real ticket to the payment.
   *
   * Delivery was a boolean an admin ticked, so a buyer who lost the WhatsApp
   * message had nothing. The file goes into a private bucket under the
   * transaction's own id, and the buyer reads exactly that object and nothing
   * else in the bucket.
   */
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Keep it under 10MB.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${txId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(
          upErr.message.includes("Bucket not found")
            ? "Run supabase/migration-ticket-file.sql first."
            : upErr.message
        );
        return;
      }
      const { data, error } = await supabase.rpc("admin_set_ticket_file", {
        p_tx: txId,
        p_path: path,
        p_name: file.name,
      });
      if (error || data === false) {
        toast.error(error?.message ?? "Uploaded, but the row didn't update.");
        return;
      }
      toast.success("Ticket attached. The buyer can see it now.");
      router.refresh();
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) {
        toast.error(error.message);
        return;
      }
      // The functions return false for a non-admin and for a row that isn't
      // there. Without checking it, a refused write looks exactly like a
      // successful one until the page is reloaded.
      if (data === false) {
        toast.error("That didn't save. Admin only, and the row must still exist.");
        return;
      }
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!outsourced) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
          <LineIcon name="check" size={12} />
          In app
        </span>
        {eventId && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              call(
                "admin_set_event_outsourced",
                { p_event: eventId, p_outsourced: true },
                "Marked outsourced"
              )
            }
            className="text-[11px] font-semibold text-gray-400 underline transition hover:text-brand disabled:opacity-50"
          >
            Mark outsourced
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          call(
            "admin_set_ticket_delivered",
            { p_tx: txId, p_delivered: !delivered, p_note: note },
            delivered ? "Marked undelivered" : "Marked delivered"
          )
        }
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
          delivered
            ? "bg-naija-50 text-emerald-800 hover:bg-naija-100"
            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
        }`}
      >
        <LineIcon name={delivered ? "check" : "clock"} size={12} />
        {delivered ? "Delivered" : "Not delivered"}
      </button>
      {/* The ticket itself. Marking delivered says it happened somewhere
          else; this puts it in the buyer's hands. */}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand underline transition hover:text-brand-600 disabled:opacity-50"
      >
        <LineIcon name="ticket" size={11} />
        {busy ? "Uploading…" : hasFile ? "Replace ticket" : "Upload ticket"}
      </button>
      {hasFile && (
        <span className="max-w-[150px] truncate text-[11px] text-gray-400">
          {fileName ?? "attached"}
        </span>
      )}

      {eventId && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(
              "admin_set_event_outsourced",
              { p_event: eventId, p_outsourced: false },
              "No longer outsourced"
            )
          }
          className="text-[11px] font-semibold text-gray-400 underline transition hover:text-brand disabled:opacity-50"
        >
          Not outsourced
        </button>
      )}
    </div>
  );
}
