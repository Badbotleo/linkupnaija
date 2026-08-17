import { categoryStyle } from "@/lib/constants";
import NaijaFlag from "./ui/NaijaFlag";

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
      {/* The flag is drawn, not typed — see NaijaFlag. Every other category
          uses a pictographic emoji, which platforms render in colour
          reliably; flags are the exception. */}
      {emoji === "\ud83c\uddf3\ud83c\uddec" ? (
        <NaijaFlag size={12} />
      ) : (
        <span aria-hidden>{emoji}</span>
      )}
      {category}
    </span>
  );
}
