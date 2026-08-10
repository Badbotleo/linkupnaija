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
  // No reviews yet → render nothing.
  //
  // This used to say "✨ New host". Read on one card it's a warm little
  // disclosure; read down a whole feed where every host has it, it says
  // nobody established uses this platform. The badge earned us nothing and
  // cost us that, so an unrated host now simply carries no rating line.
  if (!count) return null;
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
