import Image from "next/image";

// User avatar with graceful fallback to the first initial.
// Uses the optimized Next <Image> for user-uploaded Supabase storage URLs.

const SIZES = {
  sm: { cls: "h-9 w-9 text-sm", px: 36 },
  md: { cls: "h-12 w-12 text-base", px: 48 },
  lg: { cls: "h-20 w-20 text-2xl", px: 80 },
} as const;

export default function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string | null;
  url: string | null;
  size?: keyof typeof SIZES;
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
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

  return (
    <span
      className={`${wrap} grid place-items-center bg-brand font-bold text-white`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
