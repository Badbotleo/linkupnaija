export default function VerifiedBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      title="Socially verified — this person has linked at least one social account"
      className={`inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand ${className}`}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
        <path d="M12 2l2.39 1.74 2.95-.02 1.13 2.72 2.4 1.72-.92 2.81.92 2.81-2.4 1.72-1.13 2.72-2.95-.02L12 22l-2.39-1.74-2.95.02-1.13-2.72-2.4-1.72.92-2.81-.92-2.81 2.4-1.72L6.66 3.7l2.95.02L12 2zm-1.3 13.3l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
      </svg>
      Verified
    </span>
  );
}
