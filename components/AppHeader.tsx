"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import LineIcon from "./ui/LineIcon";

// App-style screen header — the native pattern, not a marketing hero.
//
// A website opens a page with a big coloured banner, a headline and a tagline.
// An app opens a screen with a compact bar: back affordance, a large title
// sitting directly on the page background, a thin line of real context, and
// the screen's primary action within thumb reach. Content starts immediately
// underneath. That is what this renders.
export default function AppHeader({
  title,
  subtitle,
  back = false,
  action,
  meta,
  children,
}: {
  title: React.ReactNode;
  /** One short line of real context — counts, location, status. */
  subtitle?: React.ReactNode;
  /** Show a back chevron that pops the history stack. */
  back?: boolean;
  /** Primary action for this screen, right-aligned on the title row. */
  action?: React.ReactNode;
  /**
   * Small pills under the title: counts, filters, status.
   *
   * Give a pill an `href` and it becomes a link with a chevron. A pill that
   * is shaped like a chip but does nothing when tapped reads as a broken
   * button, so anything the screen can actually change should carry one.
   */
  meta?: { icon?: string; label: React.ReactNode; href?: string }[];
  /** Segmented control / filter row rendered flush under the header. */
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    // The dark tint is black, not gray-900.
    //
    // gray-900 is #111827, a navy, and the dark body is pure black. The
    // header was rendering as a lighter blue slab across the top of every
    // screen that uses it: the banner look this component exists to avoid,
    // visible only in dark mode because the light tint happens to match the
    // light page. Matching the page in both themes leaves the border doing
    // the separating, which is the app pattern.
    <header className="sticky top-16 z-30 lg:top-0 border-b border-gray-100 bg-[#F7F7F9]/85 backdrop-blur-md dark:bg-black/85">
      {/* Tighter on a phone than on a desktop, deliberately.
          On /events this bar, the navbar above it, the tab row and the story
          rail come to 362px before the first event on an iPhone 13, and an
          in-app browser's own chrome takes ~90px more. That is most of a
          screen spent on furniture, and the feed pays for all of it. */}
      <div className="container-page py-2.5 sm:py-4">
        <div className="flex items-start gap-3">
          {back && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              // 44px, not 36. Back is the most-tapped control on any inner
              // screen and it sits in the corner a thumb reaches worst.
              className="-ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 transition-[transform,background-color] duration-150 hover:bg-gray-100 active:scale-[0.94] dark:text-white/80 dark:hover:bg-white/10"
            >
              <LineIcon name="chevronLeft" size={20} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-[30px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          {action && <div className="mt-0.5 shrink-0">{action}</div>}
        </div>

        {meta && meta.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2.5">
            {meta.map((m, i) => {
              const base =
                "inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700";
              const inner = (
                <>
                  {m.icon && <LineIcon name={m.icon} size={13} className="text-gray-500" />}
                  {m.label}
                </>
              );

              return m.href ? (
                <Link
                  key={i}
                  href={m.href}
                  className={`${base} transition hover:bg-gray-200 active:scale-95 dark:hover:bg-white/10`}
                >
                  {inner}
                  <LineIcon name="chevronRight" size={12} className="-mr-0.5 text-gray-400" />
                </Link>
              ) : (
                <span key={i} className={base}>
                  {inner}
                </span>
              );
            })}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>
    </header>
  );
}
