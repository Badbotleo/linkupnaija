"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";

const KEY = "lun_loc_dismissed";

export default function LocationMatch() {
  const router = useRouter();
  const supabase = createClient();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  function matchState(raw: string, city: string): string | null {
    if (/abuja|federal capital/i.test(raw) || /abuja/i.test(city)) return "FCT - Abuja";
    const clean = raw.replace(/\s*state$/i, "").trim().toLowerCase();
    return (
      NIGERIAN_STATES.find(
        (s) => s.toLowerCase() === clean || s.toLowerCase().includes(clean) || clean.includes(s.toLowerCase())
      ) ?? null
    );
  }

  function useLocation() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const state = matchState(
            data?.address?.state ?? "",
            data?.address?.city ?? data?.address?.town ?? ""
          );
          if (!state) {
            toast.error("Couldn't match your area to a state. Pick one manually.");
            setBusy(false);
            return;
          }
          // Save to profile for better matching next time (best-effort).
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) await supabase.from("users").update({ state }).eq("id", user.id);
          dismiss();
          router.push(`/events?state=${encodeURIComponent(state)}`);
        } catch {
          toast.error("Something went wrong finding your area.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        toast.error("Location permission denied.");
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-50/50 p-3.5">
      <span className="text-2xl">📍</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">See events near you</p>
        <p className="text-xs text-gray-500">
          Use your location for the best matches in your area.
        </p>
      </div>
      <button type="button" onClick={useLocation} disabled={busy} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
        {busy ? "…" : "Use location"}
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-gray-400 hover:text-gray-600">
        ✕
      </button>
    </div>
  );
}
