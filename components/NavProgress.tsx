"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// A YouTube-style top loading bar that flashes on each route change.
export default function NavProgress() {
  const pathname = usePathname();
  const [stage, setStage] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    setStage("loading");
    const t1 = setTimeout(() => setStage("done"), 350);
    const t2 = setTimeout(() => setStage("idle"), 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  const width = stage === "loading" ? "85%" : stage === "done" ? "100%" : "0%";
  const opacity = stage === "idle" ? 0 : 1;

  return (
    <div className="fixed inset-x-0 top-0 z-[61] h-[3px]" aria-hidden style={{ pointerEvents: "none" }}>
      <div
        className="h-full bg-gradient-to-r from-[#534AB7] to-[#7F77DD] shadow-[0_0_8px_rgba(127,119,221,0.7)]"
        style={{
          width,
          opacity,
          transition: "width 0.35s ease, opacity 0.3s ease",
        }}
      />
    </div>
  );
}
