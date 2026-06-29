"use client";

import { useEffect, useState } from "react";

// Thin bar at the very top that fills as the user scrolls. Hidden at the top.
export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? (el.scrollTop / max) * 100 : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[3px]"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-[#534AB7] to-[#7F77DD] transition-[width] duration-100 ease-out"
        style={{ width: `${pct}%`, opacity: pct < 0.5 ? 0 : 1 }}
      />
    </div>
  );
}
