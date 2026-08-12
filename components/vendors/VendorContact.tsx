"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { detectLeaks, LEAK_LABELS } from "@/lib/external-links";
import LineIcon from "../ui/LineIcon";

/**
 * A host briefing a vendor.
 *
 * On platform, deliberately. A marketplace whose first action is "here's my
 * WhatsApp" is a directory: nobody has a record of what was agreed, the
 * vendor can't be held to it, and the host has no recourse when a caterer
 * doesn't turn up.
 *
 * The fields are the ones a vendor needs before they can quote — date, head
 * count, budget. A message that says "how much?" wastes both people's time.
 */
export default function VendorContact({
  vendorId,
  vendorName,
}: {
  vendorId: string;
  vendorName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    message: "",
    event_date: "",
    guests: "",
    budget: "",
  });

  async function send() {
    if (sending) return;
    const message = form.message.trim();
    if (message.length < 10) {
      toast.error("Tell them what you need — a line or two at least.");
      return;
    }

    // Same rule as event descriptions. Contact details belong in the reply
    // once both sides have agreed something, not in a cold brief that also
    // publishes your number into a table somebody else can read.
    const leaks = detectLeaks(message);
    if (leaks.length > 0) {
      toast.error(
        `Leave the ${leaks
          .map((l) => LEAK_LABELS[l.kind].toLowerCase())
          .join(" and ")} out — they'll reply here.`
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/vendors`);
      return;
    }

    setSending(true);
    const { error } = await supabase.from("vendor_inquiries").insert({
      vendor_id: vendorId,
      host_id: user.id,
      message,
      event_date: form.event_date || null,
      guests: form.guests ? Math.max(1, Math.round(Number(form.guests))) : null,
      budget: form.budget ? Math.max(0, Math.round(Number(form.budget))) : null,
    });
    setSending(false);

    if (error) {
      toast.error(
        /vendor_inquiries/.test(error.message)
          ? "Run supabase/migration-vendors.sql first."
          : error.message
      );
      return;
    }
    toast.success(`Sent to ${vendorName}. They'll reply here.`);
    setOpen(false);
    setForm({ message: "", event_date: "", guests: "", budget: "" });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm"
      >
        <LineIcon name="send" size={15} />
        Contact {vendorName}
      </button>
    );
  }

  return (
    <div className="surface space-y-2 p-4">
      <p className="font-bold text-gray-900">What do you need?</p>
      <textarea
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        rows={4}
        maxLength={2000}
        placeholder="What the event is, what you want from them, anything they should know."
        className="input"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-bold text-gray-500">Event date</span>
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-500">Guests</span>
          <input
            inputMode="numeric"
            value={form.guests}
            onChange={(e) => setForm({ ...form, guests: e.target.value })}
            placeholder="e.g. 60"
            className="input"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-500">Budget (₦)</span>
          <input
            inputMode="numeric"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder="e.g. 250000"
            className="input"
          />
        </label>
      </div>
      <p className="text-xs text-gray-400">
        Date, head count and budget are what a vendor needs before they can
        quote. Without them the first reply is just those questions.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-bold text-gray-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
