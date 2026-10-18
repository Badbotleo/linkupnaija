import { categoryStyle } from "@/lib/constants";
import NaijaFlag from "./ui/NaijaFlag";
import LineIcon from "./ui/LineIcon";
import { categoryIcon } from "@/lib/category-icons";

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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge} ${className}`}
    >
      {/* DRAWN, NOT TYPED.
          Every category carried a keyboard emoji, so the chip on every card
          in the product rendered in whatever Apple, Google or Samsung draws,
          at a different weight and colour per device, beside a product drawn
          in one line style.

          The flag stays drawn for its own reason: NaijaFlag exists because
          platforms render flag emoji least reliably of all. */}
      {emoji === "\ud83c\uddf3\ud83c\uddec" ? (
        <NaijaFlag size={12} />
      ) : (
        <LineIcon name={categoryIcon(category)} size={12} className="shrink-0" />
      )}
      {category}
    </span>
  );
}
