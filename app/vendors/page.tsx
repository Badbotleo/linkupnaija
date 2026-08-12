import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { formatNaira } from "@/lib/paystack";
import { NIGERIAN_STATES } from "@/lib/constants";
import { listVendors, VENDOR_CATEGORIES } from "@/lib/vendors";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vendors · LinkUpNaija",
  description: "Food, drinks, decor, DJs and everything else an event needs.",
};

/**
 * The vendor directory.
 *
 * Hosting is the hard part of this platform, and most of the hard part is
 * logistics: who's doing the food, who's bringing drinks, who's shooting it.
 * Every one of those is currently a WhatsApp group and a prayer.
 */
export default async function VendorsPage({
  searchParams,
}: {
  searchParams: { category?: string; state?: string; q?: string };
}) {
  const vendors = await listVendors(searchParams);
  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      scroll={false}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        on ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </Link>
  );

  const withParam = (k: string, v: string | undefined) => {
    const p = new URLSearchParams();
    for (const [key, val] of Object.entries(searchParams))
      if (val && key !== k) p.set(key, val);
    if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/vendors?${qs}` : "/vendors";
  };

  return (
    <div>
      <AppHeader
        title="Vendors"
        subtitle={<>Food, drinks, decor, DJs — everything an event needs</>}
      />
      <div className="container-page py-5">
        <form action="/vendors" className="mb-4">
          {searchParams.category && (
            <input type="hidden" name="category" value={searchParams.category} />
          )}
          {searchParams.state && (
            <input type="hidden" name="state" value={searchParams.state} />
          )}
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search vendors"
            className="input"
          />
        </form>

        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
          {chip("All", withParam("category", undefined), !searchParams.category)}
          {VENDOR_CATEGORIES.map((c) =>
            chip(c, withParam("category", c), searchParams.category === c)
          )}
        </div>

        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {chip("Anywhere", withParam("state", undefined), !searchParams.state)}
          {NIGERIAN_STATES.map((s) =>
            chip(s, withParam("state", s), searchParams.state === s)
          )}
        </div>

        {vendors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
            <p className="font-semibold text-gray-700">No vendors here yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              {searchParams.category || searchParams.state || searchParams.q
                ? "Try a wider search."
                : "We're onboarding the first ones now."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <Link
                key={v.id}
                href={`/vendors/${v.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative h-36 w-full bg-gray-100">
                  {v.galleryUrls[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={v.galleryUrls[0]}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-gray-300">
                      <LineIcon name="briefcase" size={28} />
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-900">
                    {v.category}
                  </span>
                  {/* Vetting only counts if it shows where someone chooses. */}
                  {v.isVerified && (
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-naija-600 px-2 py-1 text-[10px] font-black text-white">
                      <LineIcon name="check" size={10} />
                      Vetted
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate font-bold text-gray-900 group-hover:text-brand">
                    {v.name}
                  </p>
                  {v.tagline && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {v.tagline}
                    </p>
                  )}
                  <p className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-400">{v.state ?? "Nigeria"}</span>
                    {/* Nothing rather than "₦0" — same rule as everywhere else. */}
                    {!!v.priceFrom && v.priceFrom > 0 && (
                      <span className="font-extrabold tabular-nums text-gray-900">
                        from {formatNaira(v.priceFrom)}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
