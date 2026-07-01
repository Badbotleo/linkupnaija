"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function EventsTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "foryou" ? "foryou" : "all";

  const href = (t: "all" | "foryou") => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "foryou") params.set("tab", "foryou");
    else params.delete("tab");
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1">
      <Link
        href={href("all")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          tab === "all" ? "bg-white text-brand shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        All events
      </Link>
      <Link
        href={href("foryou")}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          tab === "foryou" ? "bg-white text-brand shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        ✨ For You
      </Link>
    </div>
  );
}
