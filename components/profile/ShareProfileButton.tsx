"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

export default function ShareProfileButton() {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ url, title: "My LinkUpNaija profile" });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Profile link copied");
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="btn-outline flex-1 rounded-full py-2">
      {copied ? "Copied!" : "Share profile"}
    </button>
  );
}
