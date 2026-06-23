// Gold "Pro" badge for LinkUpNaija Pro subscribers.
export default function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="LinkUpNaija Pro member"
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${className}`}
    >
      <span aria-hidden>★</span> Pro
    </span>
  );
}
