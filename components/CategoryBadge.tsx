import { categoryStyle } from "@/lib/constants";

export default function CategoryBadge({
  category,
  className = "",
}: {
  category: string;
  className?: string;
}) {
  const { badge, emoji } = categoryStyle(category);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge} ${className}`}
    >
      <span aria-hidden>{emoji}</span>
      {category}
    </span>
  );
}
