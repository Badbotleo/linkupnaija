import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { notFound } from "next/navigation";
import EventCover from "@/components/EventCover";
import LineIcon from "@/components/ui/LineIcon";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";
import PartnerHero from "@/components/partners/PartnerHero";
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

  /**
   * The button says what pressing it does.
   *
   * A slogan at the bottom of a page about tables and combo packs makes
   * people guess. Entry to SUMMER GAMES is free, so what anyone is actually
   * deciding is whether to reserve a table — and that is what it should say.
   *
   * Derived, not hardcoded, so a partner selling only combos, or nothing at
   * all, still gets a label that is true for them.
   */
  const cta =
    tables.length > 0
      ? "Reserve a table"
      : combos.length > 0
        ? "Get your ticket"
        : "Join the night";

  return (
    <div className="pb-28">
      <AppHeader title={`LinkUpNaija × ${partner.name}`} back />
      {/* --- hero ---------------------------------------------------------
          One hero, not two. The posters used to sit in a block ABOVE a solid
          colour panel, so the page opened with two competing headers and you
          scrolled past the artwork to reach the words. The lockup is a thin
          band now, the posters ARE the hero, and the call to action sits
          under them where you land after swiping. */}
      <section style={{ backgroundColor: brand }} className="text-white">
        <div className="container-page flex flex-wrap items-center gap-2.5 py-4">
          <span className="text-[17px] font-extrabold tracking-tight sm:text-[19px]">
            LinkUpNaija
          </span>
          {/* Ours in the lockup, so it stays LinkUpNaija purple. */}
          <span className="text-[19px] font-black text-[#8B83E6]">×</span>
          {partner.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={partner.logoUrl}
              alt={partner.name}
              className="h-7 w-auto max-w-[150px] object-contain"
            />
          ) : (
            <span className="text-[17px] font-extrabold tracking-tight sm:text-[19px]">
              {partner.name}
            </span>
          )}
        </div>

        {/* The partner's OWN artwork leads. Their designer made a flyer that
            says everything in their voice; our generated square is a
            competent summary of the same facts and nowhere near as good.
            The generated cards are the fallback for a partner who hasn't
            uploaded anything yet, so a new page is never empty. */}
        <PartnerHero
          brand={brand}
          slides={
            partner.posterUrls.length > 0
              ? partner.posterUrls.map((src, i) => ({
                  src,
                  label: `${partner.name} artwork ${i + 1}`,
                }))
              : events.map((e) => ({
                  src: `/api/ig-card/${e.id}`,
                  label: `${partner.name} — ${e.title}`,
                }))
          }
        />

        <div className="container-page pb-10 pt-6">
          <h1 className="max-w-2xl text-[28px] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
            {partner.collabBlurb ?? partner.tagline ?? "A different kind of night in Abuja."}
          </h1>
          {events.length > 0 && (
            <Link
              href={`/events/${events[0].id}`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-black text-gray-900 transition hover:opacity-90"
            >
              {/* The app's verb is "link up" everywhere else, and their
                  TikTok is literally @makewelinkupnaija. "Get on the list"
                  was a nightclub's words, not ours. */}
              {cta}
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
                <div className="no-scrollbar -mx-4 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                <div className="no-scrollbar -mx-4 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
            <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="group w-[76vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
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

      {/* Sticky, because the whole page is about doing one thing. On a
          website this is a link you scroll past once; in an app it stays
          where your thumb is. */}
      {events.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/85 p-3 backdrop-blur-lg lg:hidden dark:bg-[#1A1040]/85">
          <Link
            href={`/events/${events[0].id}`}
            className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white"
            style={{ backgroundColor: brand }}
          >
            {cta}
            <LineIcon name="chevronRight" size={14} />
          </Link>
        </div>
      )}
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
    <div className="w-[74vw] max-w-[260px] shrink-0 snap-start rounded-2xl border border-gray-200 bg-white p-4">
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
