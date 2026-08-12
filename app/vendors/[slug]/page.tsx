import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import VendorContact from "@/components/vendors/VendorContact";
import { formatNaira } from "@/lib/paystack";
import { getVendor } from "@/lib/vendors";

export const dynamic = "force-dynamic";

const isVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const v = await getVendor(params.slug);
  if (!v) return { title: "Vendor not found" };
  return {
    title: `${v.name} · LinkUpNaija`,
    description: v.tagline ?? v.about?.slice(0, 150) ?? `${v.category} on LinkUpNaija.`,
  };
}

export default async function VendorPage({
  params,
}: {
  params: { slug: string };
}) {
  const vendor = await getVendor(params.slug);
  if (!vendor) notFound();

  return (
    <div className="pb-24">
      <AppHeader title={vendor.name} back />

      <div className="container-page py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
            {vendor.category}
          </span>
          {vendor.state && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              <LineIcon name="pin" size={11} />
              {vendor.state}
            </span>
          )}
          {vendor.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-naija-50 px-2.5 py-1 text-xs font-bold text-naija-700">
              <LineIcon name="check" size={11} />
              Vetted by LinkUpNaija
            </span>
          )}
        </div>

        <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          {vendor.name}
        </h1>
        {vendor.tagline && (
          <p className="mt-1 text-[15px] text-gray-500">{vendor.tagline}</p>
        )}
        {!!vendor.priceFrom && vendor.priceFrom > 0 && (
          <p className="mt-3 text-[22px] font-extrabold tabular-nums text-gray-900">
            from {formatNaira(vendor.priceFrom)}
          </p>
        )}

        <div className="mt-5">
          <VendorContact vendorId={vendor.id} vendorName={vendor.name} />
        </div>

        {vendor.about && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">About</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600">
              {vendor.about}
            </p>
          </section>
        )}

        {vendor.galleryUrls.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">Their work</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {vendor.galleryUrls.map((u) => (
                <div key={u} className="overflow-hidden rounded-xl bg-gray-100">
                  {isVideo(u) ? (
                    <video
                      src={u}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      controls
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={u}
                      alt={`${vendor.name} work`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
