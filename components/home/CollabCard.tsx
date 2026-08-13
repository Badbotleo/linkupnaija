import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LineIcon from "@/components/ui/LineIcon";
import { safeColor, safeUrl } from "@/lib/partners";

/**
 * "LinkUpNaija × PARTNER" — a running collaboration, given its own card.
 *
 * Separate from the featured shelf on purpose. That shelf is the boost a host
 * pays for; this is a partnership we chose. Mixing them would mean a paying
 * host could rank below one who didn't pay, and nobody could tell which was
 * which.
 *
 * A card in the page, not a pop-up. The FC26 modal was removed for spamming
 * people, and the lesson stuck: this waits to be scrolled to.
 */
export default async function CollabCard() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("slug, name, tagline, collab_blurb, logo_url, cover_url, brand_color, accent_color")
    .eq("is_active", true)
    .eq("is_collab", true)
    .gt("collab_until", new Date().toISOString())
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Supporting content: no collab, or a missing column, means no card — never
  // a broken home page.
  if (error || !data) return null;

  const p = data as {
    slug: string;
    name: string;
    tagline: string | null;
    collab_blurb: string | null;
    logo_url: string | null;
    cover_url: string | null;
    brand_color: string | null;
    accent_color: string | null;
  };
  const cover = safeUrl(p.cover_url);
  const logo = safeUrl(p.logo_url);
  const brand = safeColor(p.brand_color, "#534AB7");
  const accent = safeColor(p.accent_color, "#FAC775");

  return (
    <section className="container-page mt-6">
      <Link
        // The campaign page for partners that have one, the generic
        // template for everyone else.
        href={p.slug === "defcon" ? "/defcon" : `/partners/${p.slug}`}
        className="group relative block overflow-hidden rounded-3xl shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
        style={{ backgroundColor: brand }}
      >
        {/* The artwork IS the banner. It used to sit at opacity-25 behind a
            flat colour block, which threw away the thing people actually
            respond to and left a coloured rectangle with words on it. Now it
            leads, and the scrim only darkens the strip the text sits in. */}
        {cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        )}
        {cover && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        )}

        <div
          className={`relative p-6 sm:p-8 ${
            cover ? "min-h-[260px] sm:min-h-[300px]" : ""
          } flex flex-col justify-end text-white`}
        >
          {/* The lockup: both names, equal billing — that's what a
              collaboration is. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[17px] font-extrabold tracking-tight">
              LinkUpNaija
            </span>
            {/* LinkUpNaija's purple, not the partner's accent: the × is
                ours in the lockup. The lighter brand purple rather than
                #534AB7, which goes muddy on a red ground. */}
            <span
              className="text-[17px] font-black text-[#8B83E6]"
              aria-label="x"
            >
              ×
            </span>
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logo}
                alt={p.name}
                className="h-6 w-auto max-w-[130px] object-contain"
              />
            ) : (
              <span className="text-[17px] font-extrabold tracking-tight">
                {p.name}
              </span>
            )}
          </div>

          <p
            className="mt-4 text-[11px] font-black uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            Collaboration
          </p>
          <p className="mt-1 max-w-lg text-[24px] font-extrabold uppercase leading-[1.05] tracking-[-0.01em] sm:text-[30px]">
            {p.collab_blurb ?? p.tagline ?? `Nights with ${p.name}.`}
          </p>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-black text-gray-900">
            {/* Names the partner rather than sloganising. This card sits
                between other home-page shelves, so "what is this and where
                does it go" has to survive being read at a glance. */}
            See {p.name} nights
            <LineIcon name="chevronRight" size={13} />
          </span>
        </div>
      </Link>
    </section>
  );
}
