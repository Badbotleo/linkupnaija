"use client";

import { useState } from "react";
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
}: {
  txId: string;
  eventId: string | null;
  delivered: boolean;
  outsourced: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

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
