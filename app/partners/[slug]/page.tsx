import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import {
  getPartner,
  getPartnerEvents,
  getPartnerPriceRange,
  safeColor,
} from "@/lib/partners";

export const dynamic = "force-dynamic";

/**
 * A partner's own page.
 *
 * Driven entirely by the `partners` row, so adding the next partner is a
 * database insert rather than a deploy. Their colours, logo, cover and copy
 * come from data; the layout is ours.
 *
 * Deliberately NO phone numbers or emails. A partner page that prints a
 * mobile number is a page that teaches people to leave — and it publishes
 * someone's personal contact details to the open internet, which is a
 * different and worse problem. Bookings go through the events on this page.
 */

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const p = await getPartner(params.slug);
  if (!p) return { title: "Partner not found" };
  const description = p.tagline ?? p.about?.slice(0, 150) ?? `${p.name} on LinkUpNaija.`;
  return {
    title: `${p.name} · LinkUpNaija`,
    description,
    openGraph: { title: p.name, description, type: "profile" },
  };
}

export default async function PartnerPage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = await getPartner(params.slug);
  if (!partner) notFound();

  const [events, priceRange] = await Promise.all([
    getPartnerEvents(partner.id),
    getPartnerPriceRange(partner.id),
  ]);
  const brand = safeColor(partner.brandColor, "#534AB7");
  const accent = safeColor(partner.accentColor, "#FAC775");

  return (
    <div className="pb-24">
      <AppHeader title={partner.name} back />

      {/* Their identity, not ours.

          The cover used to sit at opacity-30 BEHIND this text. A trade fair
          poster carries its own headline, its own theme and its own dates
          burned into the artwork, so our name landed on top of theirs and
          both became unreadable, while the art itself was washed out to a
          third of its strength. Two headlines on one image is exactly the
          mistake the event card fixed months ago by giving the poster its own
          panel.

          So the artwork gets a band of its own at full strength, fading into
          their brand colour, and our words start where it ends. */}
      <section className="overflow-hidden" style={{ backgroundColor: brand }}>
        {partner.coverUrl && (
          <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={partner.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* A short fade so the band and the panel read as one surface
                rather than a photo glued above a box. */}
            <div
              className="absolute inset-x-0 bottom-0 h-20"
              style={{ backgroundImage: `linear-gradient(to top, ${brand}, transparent)` }}
            />
          </div>
        )}
        <div className="container-page relative pb-9 pt-5 text-white">
          {partner.logoUrl && (
            /* On white, because a partner logo is usually drawn for paper and
               a transparent PNG disappears into whatever brand colour they
               chose. */
            <span className="mb-4 inline-flex rounded-2xl bg-white p-3 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={partner.logoUrl}
                alt={partner.name}
                className="h-14 w-auto max-w-[200px] object-contain"
              />
            </span>
          )}
          <p
            className="text-[11px] font-black uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            LinkUpNaija partner
          </p>
          <h1 className="mt-1.5 text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[38px]">
            {partner.name}
          </h1>
          {partner.tagline && (
            <p className="mt-2 max-w-xl text-[15px] text-white/85">
              {partner.tagline}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {partner.state && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                <LineIcon name="pin" size={12} />
                {partner.state}
              </p>
            )}
            {/* The question people actually arrive with, answered before they
                have to open three events to find out. */}
            {priceRange && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                <LineIcon name="ticket" size={12} />
                {priceRange.min === priceRange.max
                  ? formatNaira(priceRange.min)
                  : `${formatNaira(priceRange.min)} – ${formatNaira(priceRange.max)}`}
                <span className="font-medium text-white/60">
                  · {priceRange.count} option
                  {priceRange.count === 1 ? "" : "s"}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="container-page py-6">
        {partner.about && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900">About</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-600">
              {partner.about}
            </p>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-gray-900">
            What&apos;s coming up
          </h2>
          {events.length === 0 ? (
            /* "Check back shortly" is a dead end on the one section that
               justifies this page existing. Somebody reading a partner page
               is already interested in the thing; the useful move is to let
               them start the link-up nobody has started yet. */
            <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center dark:border-white/15 dark:bg-white/[0.03]">
              <p className="font-bold text-gray-900 dark:text-white">
                Nobody has organised a meet-up here yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Going anyway? Start one and the people going can find you.
              </p>
              <Link
                href={`/host?title=${encodeURIComponent(
                  `Meet up at ${partner.name}`
                )}${partner.state ? `&state=${encodeURIComponent(partner.state)}` : ""}`}
                className="btn-primary mt-4 inline-flex"
              >
                Host one here
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-36 w-full"
                    fit="cover"
                  />
                  <div className="p-4">
                    <p className="line-clamp-2 font-bold text-gray-900 group-hover:text-brand">
                      {e.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatEventDate(e.date)} · {formatEventTime(e.time)}
                    </p>
                    <p className="truncate text-xs text-gray-400">{e.location}</p>
                    {e.price > 0 && (
                      <p className="mt-2 text-sm font-extrabold tabular-nums text-gray-900">
                        {formatNaira(e.price)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* The partner's own artwork.
            poster_urls has been collected by the admin form and stored on the
            row since partners existed, and nothing ever rendered it: four
            uploaded posters sat in the database while the page showed none.
            An upload that goes nowhere is worse than no upload field, because
            the person doing it believes the job is done.

            ImageLightbox because a trade-fair flyer is dense with dates,
            stand numbers and phone numbers that are unreadable at thumbnail
            size, and tapping to enlarge is the whole point of showing it. */}
        {partner.posterUrls.length > 0 && (
          <section className="mt-8">
            {/* The partner's own name, not a label for the file type.
                "Their flyers" described the attachment and "Straight from
                them" described the relationship; neither told you whose
                artwork you were about to look at. The name does, and it reads
                as a credit line over the gallery. */}
            <h2 className="text-lg font-bold text-gray-900">{partner.name}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {partner.posterUrls.map((url, i) => (
                /* One shape, whatever shape they uploaded. These were
                   rendered at their natural aspect in a two-column grid, so
                   a landscape banner beside a portrait flyer left a hole the
                   height of the difference. Tapping still opens the full
                   image uncropped, which is where the stand numbers and
                   phone numbers actually get read. */
                <ImageLightbox
                  key={url}
                  src={url}
                  alt={`${partner.name} flyer ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  triggerClassName="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 shadow-[var(--e1)] transition-transform duration-150 active:scale-[0.98] dark:bg-white/[0.06]"
                />
              ))}
            </div>
          </section>
        )}

        {(partner.instagram || partner.tiktok || partner.website) && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">Follow them</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {partner.instagram && (
                <SocialLink href={partner.instagram} label="Instagram" />
              )}
              {partner.tiktok && <SocialLink href={partner.tiktok} label="TikTok" />}
              {partner.website && (
                <SocialLink href={partner.website} label="Website" />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand"
    >
      {label}
      <LineIcon name="chevronRight" size={13} />
    </a>
  );
}
