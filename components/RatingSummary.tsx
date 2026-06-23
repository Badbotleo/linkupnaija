// Compact host-rating display, e.g. "⭐ 4.8 · 12 reviews".
export default function RatingSummary({
  avg,
  count,
  className = "",
}: {
  avg: number;
  count: number;
  className?: string;
}) {
  if (!count) {
    return (
      <span className={`text-xs font-medium text-gray-400 ${className}`}>
        ✨ New host
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold text-gray-700 ${className}`}
    >
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      {Number(avg).toFixed(1)}
      <span className="font-normal text-gray-400">
        · {count} review{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}
