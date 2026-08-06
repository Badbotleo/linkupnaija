/**
 * A short buzz on the moments that matter.
 *
 * Native apps confirm important actions physically; web apps almost never do,
 * and it's one of the differences people feel without being able to name it.
 *
 * Deliberately sparing — only on outcomes a person is waiting for, never on
 * ordinary taps. Overused haptics read as a broken phone, not a polished app.
 *
 * Silently does nothing where unsupported (all of iOS Safari today, and any
 * desktop), so callers never need to check.
 */
type Pattern = "tap" | "success" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 10,
  // Two quick pulses reads as "done" rather than "something went wrong".
  success: [14, 40, 14],
  // One longer buzz — distinct enough to tell apart without looking.
  error: 44,
};

export function haptic(pattern: Pattern = "tap") {
  if (typeof window === "undefined") return;
  // Someone who asked for less motion very likely wants less buzzing too.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    /* unsupported — nothing to do */
  }
}
