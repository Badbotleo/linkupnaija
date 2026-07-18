"use client";

import { useEffect, useState } from "react";

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <span
        className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[#1A1040] text-3xl font-black tabular-nums sm:h-20 sm:w-20 sm:text-4xl"
        style={{ perspective: 400 }}
      >
        {/* key change replays the flip + purple glow each tick */}
        <span key={text} className="flip-number">
          {text}
        </span>
      </span>
      <span className="mt-2 text-xs uppercase tracking-wide text-white/50">
        {label}
      </span>
    </div>
  );
}

// Ready to accept a real ISO date. Until then it shows a placeholder.
export default function Countdown({ date }: { date?: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!date) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) {
    return (
      <div className="mx-auto mt-4 max-w-md rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-white/70">
        ⏳ Announcing date soon. Stay tuned
      </div>
    );
  }

  const diff = Math.max(0, new Date(date).getTime() - (now ?? Date.now()));
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <div className="mt-5 flex items-start justify-center gap-3 sm:gap-4">
      <Unit value={days} label="Days" />
      <Unit value={hours} label="Hours" />
      <Unit value={minutes} label="Minutes" />
      <Unit value={seconds} label="Seconds" />
    </div>
  );
}
