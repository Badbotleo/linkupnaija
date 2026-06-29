// Celebratory confetti effects. All effects no-op when the user prefers
// reduced motion.
import confetti from "canvas-confetti";

const BRAND = "#534AB7";
const PURPLE = "#7F77DD";
const GREEN = "#22C55E";
const GOLD = "#FAC775";

function reduced(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function originOf(el?: HTMLElement | null): { x: number; y: number } {
  if (!el || typeof window === "undefined") return { x: 0.5, y: 0.7 };
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
}

/** Green + purple burst from a button (event join / RSVP). */
export function confettiJoin(el?: HTMLElement | null) {
  if (reduced()) return;
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: originOf(el),
    colors: [GREEN, BRAND, PURPLE],
  });
}

/** Gold shower (host approves an attendee / Pro / boost). */
export function confettiGold(el?: HTMLElement | null) {
  if (reduced()) return;
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 40,
    origin: el ? originOf(el) : { x: 0.5, y: 0.4 },
    colors: [GOLD, "#FFE7A8", BRAND],
  });
}

/** Gold coin rain with ₦ symbols (successful payment). */
export function confettiCoins() {
  if (reduced()) return;
  const naira =
    typeof confetti.shapeFromText === "function"
      ? confetti.shapeFromText({ text: "₦", scalar: 2.2 })
      : undefined;
  const end = Date.now() + 1600;
  (function frame() {
    confetti({
      particleCount: 4,
      startVelocity: 0,
      ticks: 220,
      gravity: 0.85,
      scalar: 2,
      origin: { x: Math.random(), y: -0.1 },
      colors: [GOLD, "#FFD66B"],
      shapes: naira ? [naira] : undefined,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** PlayStation button symbols rain in their colours (tournament registration). */
export function confettiPs5() {
  if (reduced()) return;
  const make = (text: string) =>
    typeof confetti.shapeFromText === "function"
      ? confetti.shapeFromText({ text, scalar: 2.2 })
      : undefined;
  const symbols: { text: string; color: string }[] = [
    { text: "△", color: "#4FD1A5" },
    { text: "○", color: "#F65A78" },
    { text: "✕", color: "#5C86FF" },
    { text: "□", color: "#E06FCB" },
  ];
  const end = Date.now() + 1800;
  (function frame() {
    for (const s of symbols) {
      const shape = make(s.text);
      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: 240,
        gravity: 0.8,
        scalar: 2,
        origin: { x: Math.random(), y: -0.1 },
        colors: [s.color],
        shapes: shape ? [shape] : undefined,
      });
    }
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
