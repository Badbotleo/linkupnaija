"use client";

import { useEffect, useRef, useState } from "react";

const CYCLES = 4; // how many full 0-9 spins before landing

function SlotDigit({
  digit,
  delay,
  run,
}: {
  digit: number;
  delay: number;
  run: number;
}) {
  const finalIndex = CYCLES * 10 + digit;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const reduced = !!window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setOffset(finalIndex);
      return;
    }
    setOffset(0);
    const id = requestAnimationFrame(() => setOffset(finalIndex));
    return () => cancelAnimationFrame(id);
  }, [run, finalIndex]);

  const items = Array.from({ length: finalIndex + 1 }, (_, i) => i % 10);

  return (
    <span
      style={{
        display: "inline-block",
        height: "1em",
        overflow: "hidden",
        verticalAlign: "bottom",
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(-${offset}em)`,
          transition:
            offset === 0
              ? "none"
              : `transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        }}
      >
        {items.map((n, i) => (
          <span key={i} style={{ height: "1em", lineHeight: 1 }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

// Slot-machine style number that spins on view and replays when scrolled back.
export default function SlotCounter({
  value,
  prefix = "₦",
  className = "",
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [jackpot, setJackpot] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setRun((r) => r + 1);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (run === 0) return;
    setFinished(false);
    setJackpot(false);
    const t1 = setTimeout(() => {
      setFinished(true);
      setJackpot(true);
    }, 2000);
    const t2 = setTimeout(() => setJackpot(false), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [run]);

  const chars = value.toLocaleString("en-NG").split("");
  let digitIndex = 0;

  return (
    <span
      ref={ref}
      className={`relative inline-block ${finished ? "slot-glow" : ""} ${className}`}
    >
      {prefix}
      {chars.map((ch, i) => {
        if (ch < "0" || ch > "9") return <span key={i}>{ch}</span>;
        const delay = digitIndex++ * 110;
        return (
          <SlotDigit
            key={`${i}-${run}`}
            digit={Number(ch)}
            delay={delay}
            run={run}
          />
        );
      })}
      {jackpot && <span className="slot-jackpot">JACKPOT!</span>}
    </span>
  );
}
