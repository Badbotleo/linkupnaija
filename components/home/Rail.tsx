import Link from "next/link";
import LineIcon from "../ui/LineIcon";
import AutoScroll from "./AutoScroll";

/**
  * A shelf: horizontally scrolling on a phone, a grid on a desktop.
  *
  * Cards bleeding to the edge and snapping is what makes a page read as an app
  * rather than a stack of website sections — on a touchscreen. With a mouse
  * it's the wrong gesture, and at 1440px a 1192px shelf of 268px cards showed
  * four and hid the rest behind a drag most people never attempt.
  *
  * So above lg it becomes a four-across grid and the cards go fluid. Same
  * markup, same components, different arrangement.
  */
export default function Rail({
  title,
  subtitle,
  href,
  seeAll = "See all",
  auto = false,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  /** Drift the shelf along on its own until the visitor touches it. */
  auto?: boolean;
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

      {auto ? (
        <AutoScroll>{children}</AutoScroll>
      ) : (
        <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-8">
          {children}
          {/* Trailing spacer so the last card clears the edge while scrolling.
              Pointless once the shelf is a grid, and it would occupy a cell. */}
          <span aria-hidden className="w-1 shrink-0 lg:hidden" />
        </div>
      )}
    </section>
  );
}
