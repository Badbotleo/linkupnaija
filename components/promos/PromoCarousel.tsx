import Link from "next/link";

/**
 * The swipeable promo rail.
 *
 * Bold, loud, and deliberately not in the same visual language as the feed
 * beneath it: a promo that looks like an event card gets read as an event and
 * skipped. Big display type, a flat colour field, one line of body, one arrow.
 *
 * EVERY CARD POINTS AT SOMETHING THAT EXISTS. That is the whole discipline
 * here. The reference designs advertise "refer a host and earn up to 100K"
 * and free tickets for content creators; neither programme exists on this
 * platform, and a card promising one is a refund conversation waiting to
 * happen. These three are the real offers, with the real numbers:
 *
 *   /refer  ₦600 a referral, ₦3,000 to withdraw
 *   /premium gold badge behind a real ID check
 *   /host   free to list
 *
 * Server component: it is three links and no state. The snap scrolling is CSS.
 */

type Promo = {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  emoji: string;
  /** Flat field + the ink that reads on it. */
  bg: string;
  ink: string;
  sub: string;
  arrow: string;
};

const PROMOS: Promo[] = [
  {
    href: "/refer",
    eyebrow: "Invite & earn",
    title: "BRING A FRIEND, GET ₦600",
    body: "Every friend who joins and shows up earns you ₦600. Cash out at ₦3,000.",
    emoji: "💸",
    bg: "bg-[#534AB7]",
    ink: "text-[#FAC775]",
    sub: "text-white/85",
    arrow: "bg-[#FAC775] text-[#1A1040]",
  },
  {
    href: "/premium",
    eyebrow: "LinkUpNaija Premium",
    // Leads with the badge because the Premium page does. One tier, one
    // headline.
    //
    // Written as what it gets you, not how it is made. "A person checks your
    // ID" describes our workflow, which is our problem, not a reason to pay.
    // The reason to pay is that a host scrolling a queue of strangers stops
    // at a name they can trust, and yours is it.
    title: "STOP BEING A STRANGER",
    body: "Hosts approve from a queue of names they do not know. The gold badge means yours is not one of them.",
    emoji: "🏅",
    bg: "bg-[#1A1040]",
    ink: "text-[#FAC775]",
    sub: "text-white/80",
    arrow: "bg-[#FAC775] text-[#1A1040]",
  },
  {
    href: "/host",
    eyebrow: "Host a link-up",
    title: "THE NIGHT YOU WANT MIGHT NOT EXIST YET",
    body: "Listing is free and takes a couple of minutes. You approve every guest.",
    emoji: "🎤",
    bg: "bg-[#008753]",
    ink: "text-white",
    sub: "text-white/85",
    arrow: "bg-white text-[#008753]",
  },
];

export default function PromoCarousel() {
  return (
    <div
      // -mx-4 so the rail bleeds to the screen edge and the next card peeks,
      // which is the only thing that tells a thumb there is more to the right.
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:px-0"
      aria-label="Offers"
    >
      {PROMOS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={`group relative flex w-[86%] max-w-[340px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl p-5 transition-transform duration-150 active:scale-[0.98] sm:w-[340px] ${p.bg}`}
        >
          <div>
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${p.sub}`}>
              {p.eyebrow}
            </p>
            {/* Display type, tight and loud. This is the one place in the app
                that is allowed to shout. */}
            <h3
              className={`mt-2 text-[26px] font-black uppercase leading-[0.95] tracking-[-0.02em] ${p.ink}`}
            >
              {p.title}
            </h3>
            <p className={`mt-2.5 text-[14px] leading-snug ${p.sub}`}>{p.body}</p>
          </div>

          <div className="mt-6 flex items-end justify-between">
            <span className="text-[44px] leading-none" aria-hidden>
              {p.emoji}
            </span>
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] font-bold transition-transform duration-200 group-hover:translate-x-0.5 ${p.arrow}`}
              aria-hidden
            >
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
