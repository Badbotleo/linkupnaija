import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getPartnerEvents, safeColor } from "@/lib/partners";

export const dynamic = "force-dynamic";

/**
 * LinkUpNaija × DEFCON — the collaboration's own landing page.
 *
 * /partners/defcon is the generic partner template, driven entirely by data.
 * This is the campaign page: full-bleed in their colours, the menu laid out
 * the way their flyer lays it out, and one thing to do at the end.
 *
 * Still reads from the same partner row, so their copy, colours and logo
 * stay in one place rather than being duplicated into a hardcoded page.
 */

const SLUG = "defcon";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPartner(SLUG);
  if (!p) return { title: "Not found" };
  const description =
    p.collabBlurb ?? p.tagline ?? `LinkUpNaija × ${p.name}`;
  return {
    title: `LinkUpNaija × ${p.name}`,
    description,
    openGraph: { title: `LinkUpNaija × ${p.name}`, description },
  };
}

export default async function DefconPage() {
  const partner = await getPartner(SLUG);
  if (!partner) notFound();

  const supabase = createClient();
  const events = await getPartnerEvents(partner.id);

  // The menu, taken from whichever event carries it — the tiers are the
  // product here, so the page leads with them rather than burying them.
  const ids = events.map((e) => e.id as string);
  const { data: tierRows } = ids.length
    ? await supabase
        .from("ticket_tiers")
        .select("id, name, price, description, admits, event_id")
        .in("event_id", ids)
        .eq("is_active", true)
        .order("price", { ascending: true })
    : { data: [] };
  const tiers = (tierRows ?? []) as {
    id: string;
    name: string;
    price: number;
    description: string | null;
    admits: number | null;
    event_id: string;
  }[];

  // Tables admit people; combos don't. That's the split on their own flyer,
  // so it's the split here.
  const combos = tiers.filter((t) => !t.admits);
  const tables = tiers.filter((t) => !!t.admits);

  const brand = safeColor(partner.brandColor, "#E4373C");
  const accent = safeColor(partner.accentColor, "#EFEADA");

  return (
    <div className="pb-24">
      {/* --- hero ------------------------------------------------------- */}
      <section className="relative overflow-hidden" style={{ backgroundColor: brand }}>
        {partner.coverUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={partner.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="container-page relative py-14 text-white sm:py-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[20px] font-extrabold tracking-tight sm:text-[24px]">
              LinkUpNaija
            </span>
            <span className="text-[22px] font-black" style={{ color: accent }}>
              ×
            </span>
            {partner.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={partner.logoUrl}
                alt={partner.name}
                className="h-8 w-auto max-w-[180px] object-contain sm:h-10"
              />
            ) : (
              <span className="text-[20px] font-extrabold tracking-tight sm:text-[24px]">
                {partner.name}
              </span>
            )}
          </div>

          <h1 className="mt-6 max-w-2xl text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[46px]">
            {partner.collabBlurb ?? partner.tagline ?? "A different kind of night in Abuja."}
          </h1>

          {events.length > 0 && (
            <Link
              href={`/events/${events[0].id}`}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-black text-gray-900 transition hover:opacity-90"
            >
              Get on the list
              <LineIcon name="chevronRight" size={14} />
            </Link>
          )}
        </div>
      </section>

      <div className="container-page py-8">
        {partner.about && (
          <section className="mb-10 max-w-2xl">
            <p className="whitespace-pre-line text-[16px] leading-relaxed text-gray-600">
              {partner.about}
            </p>
          </section>
        )}

        {/* --- the menu --------------------------------------------------- */}
        {tiers.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900">
              What you can book
            </h2>

            {combos.length > 0 && (
              <>
                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
                  Combo packs · no reserved seats
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {combos.map((t) => (
                    <TierCard key={t.id} tier={t} brand={brand} />
                  ))}
                </div>
              </>
            )}

            {tables.length > 0 && (
              <>
                <p className="mt-7 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
                  Table reservations
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {tables.map((t) => (
                    <TierCard key={t.id} tier={t} brand={brand} />
                  ))}
                </div>
              </>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Pick a night, request to join, choose your table. No calls, no DMs.
            </p>
          </section>
        )}

        {/* --- nights ----------------------------------------------------- */}
        <section>
          <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900">
            The nights
          </h2>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Nothing listed yet. Check back shortly.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-40 w-full"
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  brand,
}: {
  tier: { name: string; price: number; description: string | null; admits: number | null };
  brand: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[0.1em] text-gray-500">
          {tier.name}
        </p>
        {!!tier.admits && (
          <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
            {tier.admits} {tier.admits === 1 ? "person" : "people"}
          </span>
        )}
      </div>
      <p
        className="mt-1 text-[26px] font-extrabold leading-none tabular-nums"
        style={{ color: brand }}
      >
        {formatNaira(tier.price)}
      </p>
      {tier.description && (
        <p className="mt-2 text-[13px] leading-snug text-gray-500">
          {tier.description}
        </p>
      )}
    </div>
  );
}
