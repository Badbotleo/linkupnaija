import { categoryGradient, categoryStyle } from "@/lib/constants";

// Event cover image, or a category-colored gradient placeholder when none.
// `className` controls size (e.g. "h-40 w-full").
export default function EventCover({
  url,
  category,
  title,
  className = "",
}: {
  url: string | null;
  category: string;
  title: string;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title}
        className={`object-cover ${className}`}
      />
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
