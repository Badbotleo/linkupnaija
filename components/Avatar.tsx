// User avatar with graceful fallback to the first initial.
// Uses a plain <img> since avatars are user-uploaded Supabase storage URLs.

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
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
  const cls = `${SIZES[size]} shrink-0 overflow-hidden rounded-full`;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? "User avatar"}
        className={`${cls} object-cover`}
      />
    );
  }

  return (
    <span
      className={`${cls} grid place-items-center bg-brand font-bold text-white`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
