import Image from "next/image";
import { categoryGradient, categoryStyle } from "@/lib/constants";

// Event cover image, or a category-colored gradient placeholder when none.
// `className` controls size (e.g. "h-40 w-full") and is applied to a relative
// wrapper so the optimized <Image fill> can cover it.
//
// `fit`:
//  - "cover"   (default) fills the box and crops the overflow — best for cards.
//  - "contain" shows the WHOLE image (no cropping) over a blurred fill of the
//    same image, so tall/portrait flyers aren't cut off. Best for the big
//    banner on the event page.
export default function EventCover({
  url,
  category,
  title,
  className = "",
  priority = false,
  fit = "cover",
}: {
  url: string | null;
  category: string;
  title: string;
  className?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
}) {
  if (url) {
    if (fit === "contain") {
      return (
        <div className={`relative overflow-hidden ${className}`}>
          {/* Blurred backdrop fills the letterbox gaps. */}
          <Image
            src={url}
            alt=""
            fill
            sizes="100vw"
            aria-hidden
            className="scale-110 object-cover blur-xl brightness-90"
            priority={priority}
          />
          {/* The full flyer, never cropped. */}
          <Image
            src={url}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain"
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        </div>
      );
    }
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
