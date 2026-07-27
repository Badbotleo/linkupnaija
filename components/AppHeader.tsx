"use client";

import { useRouter } from "next/navigation";
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
  /** Small pills under the title: counts, filters, status. */
  meta?: { icon?: string; label: React.ReactNode }[];
  /** Segmented control / filter row rendered flush under the header. */
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-16 z-30 border-b border-gray-100 bg-[#F7F7F9]/85 backdrop-blur-md dark:bg-gray-900/85">
      <div className="container-page py-3.5 sm:py-4">
        <div className="flex items-start gap-3">
          {back && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="-ml-1.5 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-600 transition hover:bg-gray-100 active:scale-95"
            >
              <LineIcon name="chevronLeft" size={20} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-[30px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          {action && <div className="mt-0.5 shrink-0">{action}</div>}
        </div>

        {meta && meta.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {meta.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700"
              >
                {m.icon && <LineIcon name={m.icon} size={13} className="text-gray-500" />}
                {m.label}
              </span>
            ))}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>
    </header>
  );
}
