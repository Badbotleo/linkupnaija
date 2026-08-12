"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Getting a ride and listing your car are the same subject.
 *
 * They were two pages that barely pointed at each other, plus a third entry
 * in the Opportunities hub, so "I have a car" had three front doors and none
 * of them were where you'd look. One screen, two tabs.
 */
export default function RidesTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const drive = params.get("tab") === "drive";

  const href = (t: "ride" | "drive") => {
    const p = new URLSearchParams(params.toString());
    if (t === "drive") p.set("tab", "drive");
    else p.delete("tab");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const tab = (label: string, hint: string, on: boolean, to: string) => (
    <Link
      href={to}
      scroll={false}
      aria-current={on ? "page" : undefined}
      className={`relative flex-1 px-4 py-3 text-center transition ${
        on ? "text-gray-900 dark:text-white" : "text-gray-500"
      }`}
    >
      <span className="block text-[15px] font-bold">{label}</span>
      <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>
      {on && (
        <span className="absolute inset-x-6 -bottom-px h-1 rounded-full bg-brand" />
      )}
    </Link>
  );

  return (
    <div className="-mx-4 flex border-b border-gray-200 sm:mx-0 dark:border-white/10">
      {tab("Get a ride", "To your next link-up", !drive, href("ride"))}
      {tab("List your car", "Earn on those rides", drive, href("drive"))}
    </div>
  );
}
