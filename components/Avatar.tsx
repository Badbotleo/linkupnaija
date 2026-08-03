import Image from "next/image";
import GeneratedAvatar from "./ui/GeneratedAvatar";

// User avatar with graceful fallback to a drawn character.
// Uses the optimized Next <Image> for user-uploaded Supabase storage URLs.

const SIZES = {
  sm: { cls: "h-9 w-9 text-sm", px: 36 },
  md: { cls: "h-12 w-12 text-base", px: 48 },
  lg2: { cls: "h-16 w-16 text-xl", px: 64 },
  lg: { cls: "h-20 w-20 text-2xl", px: 80 },
} as const;

export default function Avatar({
  name,
  url,
  size = "md",
  seed,
}: {
  name: string | null;
  url: string | null;
  size?: keyof typeof SIZES;
  /** Stable per-person value (a user id) so the drawn face never changes. */
  seed?: string | null;
}) {
  const { cls, px } = SIZES[size];
  const wrap = `${cls} shrink-0 overflow-hidden rounded-full`;

  if (url) {
    return (
      <Image
        src={url}
        alt={name ?? "User avatar"}
        width={px}
        height={px}
        loading="lazy"
        className={`${wrap} object-cover`}
      />
    );
  }

  // No photo — draw them one. `seed` prefers a stable id when the caller has
  // one; falling back to the name keeps two "Chidi"s looking alike, which is
  // still better than two identical purple letters.
  return (
    <span className={wrap} title={name ?? undefined}>
      <GeneratedAvatar seed={seed ?? name ?? "?"} className="h-full w-full" />
      <span className="sr-only">{name ?? "User"}</span>
    </span>
  );
}
