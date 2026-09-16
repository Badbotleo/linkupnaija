/**
 * "Verified" — this member has linked at least one real social account.
 *
 * A quieter claim than the gold seal beside it, and the two are deliberately
 * different shapes: ProBadge is a scalloped seal for people who pay, this is
 * a plain disc for people who showed us an Instagram. Two identical marks
 * meaning two different things is worse than one.
 *
 * WHY IT LOOKED WARPED. It sat in a flex row next to a truncating name with
 * nothing stopping it being compressed, so when the name was long the pill
 * squeezed, the text wrapped inside it, and the icon was squashed sideways.
 * shrink-0 on the pill and on the mark is the fix; whitespace-nowrap stops
 * the word breaking in half.
 *
 * The mark is also simpler than it was. The old one was a twelve-lobed
 * starburst drawn on a 24 viewBox and rendered at 12 pixels, where the lobes
 * are a third of a pixel each and turn to grey mush. A disc and a check
 * survive that size, which is the only size it is ever used at.
 */
export default function VerifiedBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      title="Verified: this member has linked a real social account"
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-brand-50 px-2 py-[3px] text-[11px] font-bold leading-none text-brand ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        role="img"
        aria-label="Verified"
        className="shrink-0"
      >
        <title>Verified</title>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path
          d="M7.8 12.4l2.7 2.7 5.7-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified
    </span>
  );
}
