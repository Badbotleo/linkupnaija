"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatEventDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function SharePlansButton({
  eventId,
  eventTitle,
  eventDate,
  eventLocation,
  hostName,
  userName,
  defaultContactName,
  defaultContactPhone,
}: {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  hostName: string;
  userName: string;
  defaultContactName: string | null;
  defaultContactPhone: string | null;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(defaultContactName ?? "");
  const [phone, setPhone] = useState(defaultContactPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  const message = `${userName} is attending "${eventTitle}" on ${formatEventDate(
    eventDate
  )} at ${eventLocation}, hosted by ${hostName}. Contact support@linkupnaija.com if you have concerns.`;

  async function record() {
    setSaving(true);
    await supabase.from("safety_checkins").upsert(
      {
        user_id: (await supabase.auth.getUser()).data.user?.id,
        event_id: eventId,
        trusted_contact_name: name.trim() || null,
        trusted_contact_phone: phone.trim() || null,
        shared_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" }
    );
    setSaving(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await record();
      toast.success("Message copied — send it to your contact.");
    } catch {
      /* ignore */
    }
  }

  const waPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "234");
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline w-full"
      >
        🛟 Share my plans
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  Share my plans
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Let someone you trust know where you&apos;ll be.
              </p>

              <div className="mt-4 grid gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Trusted contact's name"
                  className="input"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Their phone (080...)"
                  className="input"
                />
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                {message}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={record}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                    waPhone ? "" : "pointer-events-none opacity-50"
                  }`}
                  style={{ backgroundColor: "#25D366" }}
                >
                  Send via WhatsApp
                </a>
                <button type="button" onClick={copy} disabled={saving} className="btn-outline">
                  {copied ? "Copied!" : "Copy message"}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Set an emergency contact in your profile to pre-fill this next
                time. SMS auto-send isn&apos;t enabled yet — send via WhatsApp or
                copy the message.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
