// Twitter/Meta-style verified seal for LinkUpNaija Pro members — a gold
// scalloped circle with a white check, shown right after the member's name.
export default function ProBadge({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="LinkUpNaija Pro: verified member"
      className={`inline-block shrink-0 ${className}`}
    >
      <title>LinkUpNaija Pro: verified member</title>
      <defs>
        <linearGradient id="proGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBD46B" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      {/* Scalloped seal (12-lobed) */}
      <path
        fill="url(#proGold)"
        d="M12 1.4l2.05 1.86 2.72-.5.98 2.6 2.6.98-.5 2.72L22.6 12l-1.86 2.05.5 2.72-2.6.98-.98 2.6-2.72-.5L12 22.6l-2.05-1.86-2.72.5-.98-2.6-2.6-.98.5-2.72L1.4 12l1.86-2.05-.5-2.72 2.6-.98.98-2.6 2.72.5L12 1.4z"
      />
      {/* Check */}
      <path
        d="M7.5 12.3l2.8 2.8 6-6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
