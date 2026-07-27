import Link from "next/link";
import LineIcon from "../ui/LineIcon";

// Horizontally scrolling shelf — the App Store / Spotify pattern. Cards bleed
// to the screen edge and snap, which is what makes a page read as an app
// surface rather than a stack of website sections.
export default function Rail({
  title,
  subtitle,
  href,
  seeAll = "See all",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="container-page flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-[13px] text-gray-500">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 whitespace-nowrap text-sm font-bold text-brand transition hover:opacity-70"
          >
            {seeAll}
            <LineIcon name="chevronRight" size={13} className="ml-0.5 inline align-[-1px]" />
          </Link>
        )}
      </div>

      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8">
        {children}
        {/* trailing spacer so the last card clears the edge */}
        <span aria-hidden className="w-1 shrink-0" />
      </div>
    </section>
  );
}
