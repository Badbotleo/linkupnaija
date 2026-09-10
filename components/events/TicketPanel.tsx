import { formatNaira } from "@/lib/paystack";
import { buyerFee, buyerTotal } from "@/lib/pricing";

/**
 * The "Buy Ticket" panel on an event page.
 *
 * The price used to be a small dark chip in the badge row, the same weight as
 * the category and the state — easy to miss, and it gave the buyer nothing to
 * read before deciding. This makes the ticket a thing on the page: the tier,
 * the price at a size you can't miss, the host's own line about what you get,
 * and the action beside it.
 *
 * Plenty of events sell more than one thing. DEFCON runs three combo packs
 * and five table sizes; a single `price` field could only ever show one of
 * them, so hosts were putting the rest in the description where nothing could
 * read them. A tier list is the real shape of this.
 *
 * The dashed outer edge with solid cards inset is deliberate — it reads as a
 * ticket stub rather than another content card, so it doesn't compete with
 * the event's own sections.
 *
 * Free events render nothing. "₦0" as a headline is a worse answer than
 * saying nothing and letting the join button speak.
 *
 * FREE TIERS STILL RENDER, though, under a different heading. A tier can now
 * cost nothing and still be the reason somebody came: four vendor tables at
 * the trade fair are free, capped, and the whole point of that page. The
 * picker inside RsvpButton could not carry that, because it sits behind an
 * early return for logged-out visitors and only appears when there is more
 * than one tier. So a paid tier was visible to a stranger and a free one was
 * not, which is backwards. Choosing is the picker's job; saying what exists
 * is this panel's, and it has to work before anybody signs in.
 */

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  /** People admitted — set for tables and group packs. */
  admits?: number | null;
  /** null when uncapped. 0 means gone. */
  remaining?: number | null;
  /** Held for the host to allocate, even on an instant event. */
  requiresApproval?: boolean;
}

export default function TicketPanel({
  price,
  tiers = [],
  tier = "Standard",
  note,
  autoConfirm = false,
  children,
}: {
  /** The event's base price, used when there are no tiers. */
  price: number;
  tiers?: TicketTier[];
  /** Label above a single price. Ignored when tiers are present. */
  tier?: string;
  /** Host approves by hand, so nothing free is instantly yours. Wording only. */
  autoConfirm?: boolean;
  note?: string | null;
  /** The buy/join control. Only shown in the single-price case, where there
      is one unambiguous thing to buy. */
  children?: React.ReactNode;
}) {
  const priced = tiers.filter((t) => t.price > 0);

  // Nothing priced, but tiers exist: show what they are rather than nothing.
  // No threshold on the count, unlike the picker. One tier is not a choice,
  // but it is still a thing a visitor deserves to know is there.
  if (priced.length === 0 && (!price || price <= 0)) {
    if (tiers.length === 0) return null;
    return (
      <section aria-labelledby="ticket-heading">
        <h2
          id="ticket-heading"
          className="text-xl font-extrabold text-gray-900 dark:text-white"
        >
          Ways in
        </h2>
        <div className="mt-3 space-y-2 rounded-3xl border border-dashed border-gray-300 p-1.5 dark:border-white/20">
          {tiers.map((t) => {
            const gone = t.remaining !== null && (t.remaining ?? 0) <= 0;
            return (
              <div
                key={t.id}
                className="rounded-[20px] bg-white p-4 shadow-sm dark:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[15px] font-extrabold text-gray-900 dark:text-white">
                    {t.name}
                    {!!t.admits && t.admits > 1 && (
                      <span className="ml-1.5 text-[13px] font-medium text-gray-400">
                        · {t.admits} people each
                      </span>
                    )}
                  </p>
                  <span className="shrink-0 text-[13px] font-black uppercase tracking-[0.1em] text-gray-500 dark:text-white/50">
                    {gone
                      ? "Full"
                      : autoConfirm && !t.requiresApproval
                        ? "Free"
                        : "On request"}
                  </span>
                </div>
                {t.description && (
                  <p className="mt-1.5 text-[14px] leading-snug text-gray-500 dark:text-white/60">
                    {t.description}
                  </p>
                )}
                {/* Scarcity only where it is true, the same rule the picker
                    follows. An uncapped tier says nothing. */}
                {!gone && t.remaining !== null && (t.remaining ?? 0) <= 10 && (
                  <p className="mt-1.5 text-[12px] font-bold text-naija-600">
                    {t.remaining} left
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="ticket-heading">
      <h2
        id="ticket-heading"
        className="text-xl font-extrabold text-gray-900 dark:text-white"
      >
        Buy Ticket
      </h2>

      {priced.length > 0 ? (
        <>
          <div className="mt-3 space-y-2 rounded-3xl border border-dashed border-gray-300 p-1.5 dark:border-white/20">
            {priced.map((t) => (
              <div
                key={t.id}
                className="rounded-[20px] bg-white p-4 shadow-sm dark:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black uppercase tracking-[0.1em] text-gray-500 dark:text-white/50">
                      {t.name}
                    </p>
                    {/* The number a buyer will actually be charged, with the
                        fee named inside it. Showing the host's price here and
                        a larger one at checkout is the surprise this wording
                        exists to prevent. */}
                    <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
                      {formatNaira(buyerTotal(t.price))}
                    </p>
                    <p className="mt-1 text-[12px] text-gray-500 dark:text-white/50">
                      includes {formatNaira(buyerFee(t.price))} fee
                    </p>
                  </div>
                  {/* Capacity is the thing people compare tables on, so it
                      sits where the eye lands, not buried in the details. */}
                  {/* "each", because a tier carries two different counts:
                      how many of it exist, and how many people one of it
                      lets in. Beside a "4 left" line, a bare "2 people" reads
                      as the remaining number. */}
                  {!!t.admits && (
                    <span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:border-white/20 dark:text-white/70">
                      {t.admits === 1 ? "1 person" : `${t.admits} people each`}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-2 text-[14px] leading-snug text-gray-500 dark:text-white/60">
                    {t.description}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Request to join below, then tell the host which one you want.
          </p>
        </>
      ) : (
        <div className="mt-3 rounded-3xl border border-dashed border-gray-300 p-1.5 dark:border-white/20">
          <p className="px-4 py-2.5 text-[13px] font-black uppercase tracking-[0.12em] text-gray-600 dark:text-white/60">
            {tier}
          </p>
          <div className="rounded-[20px] bg-white p-5 shadow-sm dark:bg-white/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                {/* tabular-nums keeps the ₦ and digits from shifting between
                    events with different amounts. */}
                <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
                  {formatNaira(buyerTotal(price))}
                </p>
                <p className="mt-1.5 text-[13px] text-gray-500 dark:text-white/50">
                  includes {formatNaira(buyerFee(price))} fee
                </p>
                {note && (
                  <p className="mt-2 text-[15px] leading-snug text-gray-500 dark:text-white/60">
                    {note}
                  </p>
                )}
              </div>
              {children && <div className="shrink-0">{children}</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
