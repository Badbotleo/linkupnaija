import LineIcon from "@/components/ui/LineIcon";

// Gold "Boost" badge for promoted events.
//
// The star is drawn, not typed. FeaturedRail already used LineIcon's star
// and this used the text glyph, so the same badge rendered in two different
// shapes depending on which surface you were looking at.
export default function FeaturedBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm ${className}`}
    >
      <LineIcon name="star" size={11} filled /> Boost
    </span>
  );
}

// True when an event is currently featured (paid & within the 48h window).
export function isFeatured(featured: boolean, featuredUntil: string | null) {
  return featured && !!featuredUntil && new Date(featuredUntil) > new Date();
}
