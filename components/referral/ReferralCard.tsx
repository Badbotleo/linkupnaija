"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/paystack";
import { SITE_ORIGIN } from "@/lib/qr";
import { toast } from "@/lib/toast";

export default function ReferralCard({
  referralCode,
  referralCount,
  totalEarned,
  referredNames,
}: {
  referralCode: string | null;
  referralCount: number;
  totalEarned: number;
  referredNames: string[];
}) {
  const [copied, setCopied] = useState(false);

  if (!referralCode) return null;
  const link = `${SITE_ORIGIN}/join?ref=${referralCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const waText = `Join me on LinkUpNaija and get ₦500 free wallet credit for your first event! ${link}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎁</span>
        <h2 className="text-lg font-bold text-gray-900">Invite &amp; earn ₦500</h2>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Share your link. When a friend signs up and verifies their email, you
        both get {formatNaira(500)} wallet credit.
      </p>

      {/* Link + actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="input flex-1 text-sm"
          aria-label="Your referral link"
        />
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="btn-outline whitespace-nowrap">
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "#25D366" }}
          >
            WhatsApp
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-brand-50 p-4 text-center">
          <p className="text-2xl font-extrabold text-brand">{referralCount}</p>
          <p className="text-xs font-medium text-gray-500">People joined</p>
        </div>
        <div className="rounded-xl bg-green-50 p-4 text-center">
          <p className="text-2xl font-extrabold text-green-600">
            {formatNaira(totalEarned)}
          </p>
          <p className="text-xs font-medium text-gray-500">Total earned</p>
        </div>
      </div>

      {referredNames.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Joined via your link
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {referredNames.map((n, i) => (
              <span
                key={i}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
