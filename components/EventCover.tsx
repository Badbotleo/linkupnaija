import Image from "next/image";
import { categoryGradient, categoryStyle } from "@/lib/constants";

// Event cover image, or a category-colored gradient placeholder when none.
// `className` controls size (e.g. "h-40 w-full") and is applied to a relative
// wrapper so the optimized <Image fill> can cover it.
export default function EventCover({
  url,
  category,
  title,
  className = "",
  priority = false,
}: {
  url: string | null;
  category: string;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={url}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      </div>
    );
  }

  const { emoji } = categoryStyle(category);
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br ${categoryGradient(
        category
      )} ${className}`}
    >
      <span className="text-5xl drop-shadow-sm" aria-hidden>
        {emoji}
      </span>
    </div>
  );
}
