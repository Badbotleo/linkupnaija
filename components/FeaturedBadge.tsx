// Gold "Boost" badge for promoted events.
export default function FeaturedBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm ${className}`}
    >
      <span aria-hidden>★</span> Boost
    </span>
  );
}

// True when an event is currently featured (paid & within the 48h window).
export function isFeatured(featured: boolean, featuredUntil: string | null) {
  return featured && !!featuredUntil && new Date(featuredUntil) > new Date();
}
