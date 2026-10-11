import LineIcon from "./LineIcon";
import type { PATHS } from "./LineIcon";

/**
 * The illustration at the top of an empty, success or error state.
 *
 * Thirty of these were a single large emoji in a `<p className="text-4xl">`:
 * 🚀 over an empty venue list, ✅ after a booking, 🤔 on a 404. Each one was
 * a reasonable choice on its own, and together they were thirty different
 * illustration styles rendered by whichever font the device happened to
 * have — which is the same reason the category chips moved off emoji.
 *
 * This is the treatment /notifications already used for its empty state: a
 * tinted disc with one of our own glyphs in it. One component so the next
 * empty state matches the last thirty without anybody choosing again.
 *
 * `tone` exists because a delete confirmation and a successful booking
 * should not be the same colour. It is the only variation on offer, which
 * is the point.
 */
const TONES = {
  brand: "bg-brand-50 text-brand dark:bg-brand/15",
  good: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  warn: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  bad: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  quiet: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/60",
} as const;

export default function StateIcon({
  name,
  tone = "brand",
  size = 48,
  className = "",
}: {
  name: keyof typeof PATHS | string;
  tone?: keyof typeof TONES;
  /** Diameter of the disc. The glyph is half of it. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`mx-auto grid place-items-center rounded-full ${TONES[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      <LineIcon name={name} size={Math.round(size / 2)} />
    </span>
  );
}
