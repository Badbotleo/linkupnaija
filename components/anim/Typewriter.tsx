"use client";

import { useEffect, useState } from "react";

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Types `text` out letter by letter with a blinking cursor.
export default function Typewriter({
  text,
  speed = 55,
  className = "",
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (prefersReduced()) {
      setReduced(true);
      setCount(text.length);
      return;
    }
    setCount(0);
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  const done = count >= text.length;

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {!reduced && (
        <span
          aria-hidden
          className={`ml-0.5 inline-block w-[0.06em] self-stretch ${
            done ? "animate-[blink_1s_step-end_infinite]" : ""
          }`}
          style={{
            borderRight: "0.06em solid currentColor",
            opacity: done ? undefined : 1,
          }}
        />
      )}
    </span>
  );
}
