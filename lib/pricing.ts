/**
 * What a ticket costs, and who pays the platform.
 *
 * As of 1 Sep 2026 the fee is added ON TOP of the host's price instead of
 * taken out of it. A host who lists at ₦10,000 receives ₦10,000; the buyer
 * pays ₦10,900. Before this, the buyer paid ₦10,000 and the host received
 * ₦9,000.
 *
 * The reason is host supply. A host advertises "₦10,000" on their own flyer
 * and on Instagram, and under the old model the number they were paid never
 * matched the number they published, which is a conversation every host has
 * exactly once. It is also what Tix does, which is who these hosts compare us
 * to.
 *
 * The cost is that the guest now sees a bigger number than the flyer says, on
 * a funnel already converting at 2.4%. That is why the fee is always shown
 * broken out rather than folded silently into the price: a surprise at the
 * payment step is worse than a larger honest number earlier.
 *
 * It also ends Pro's "keep 95% of every ticket". Hosts now keep 100% either
 * way, so that benefit no longer exists and the Pro page must not claim it.
 */

/** Charged to the BUYER, on top of the host's price. */
export const BUYER_FEE_PERCENT = 9;

/** The fee on a given ticket subtotal, in whole naira. */
export function buyerFee(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return Math.round((subtotal * BUYER_FEE_PERCENT) / 100);
}

/** What the buyer is actually charged. */
export function buyerTotal(subtotal: number): number {
  return subtotal + buyerFee(subtotal);
}

/**
 * What the host receives: all of it.
 *
 * A function rather than a bare identity, because every payout screen should
 * read from one place if this ever changes again, and because the old
 * `collected - fee` shape is the thing being replaced.
 */
export function hostReceives(subtotal: number): number {
  return subtotal;
}

/** Cap so a stray keypress cannot bill somebody for forty tickets. */
export const MAX_TICKETS_PER_ORDER = 10;
