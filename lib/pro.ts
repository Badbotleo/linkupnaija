// LinkUpNaija Pro constants and helpers.

export const PRO_PRICE = 4999; // ₦4,999 / month
export const PRO_DAYS = 30;
/**
 * No cap on asking to join. Kept as a number so nothing importing it breaks,
 * set high enough never to bind.
 *
 * A marketplace should charge for what is scarce, and here that is attendance:
 * August ran 116 events created against 29 requests. Rationing requests
 * throttled the behaviour the platform needs most, taxed its single most
 * active member, and gave hosts with empty rooms nothing. Revisit the day
 * events start filling.
 */
export const FREE_REQUEST_LIMIT = Number.MAX_SAFE_INTEGER;
export const FREE_HOST_LIMIT = 2; // events a free member can host per month

/**
 * What LinkUpNaija keeps from a ticket sale. Pro hosts pay half.
 *
 * This is the only benefit on the tier that pays for itself rather than
 * feeling nice. A host selling ₦10,000 tickets to twenty guests keeps an
 * extra ₦10,000 in one night, against ₦4,999 a month — so the pitch stops
 * being "is this worth it" and becomes arithmetic the host can do in their
 * head before their next event.
 *
 * It also aims the discount at the members worth keeping. A ceiling on
 * hosting punishes the people doing the most work; a lower cut rewards them,
 * and it only costs the platform anything on money the platform is already
 * earning.
 */
export const PLATFORM_FEE_PERCENT = 10;
export const PRO_PLATFORM_FEE_PERCENT = 5;

/** The cut that applies to this host, as a whole-number percent. */
export function platformFeePercent(
  isPro?: boolean | null,
  expiresAt?: string | null
): number {
  return isProActive(isPro, expiresAt)
    ? PRO_PLATFORM_FEE_PERCENT
    : PLATFORM_FEE_PERCENT;
}

/**
 * Naira the platform keeps on a sale of `amount`.
 *
 * Advisory only. The database recomputes this on insert from the host's Pro
 * status at that moment — see migration-pro-half-fee.sql — because the row is
 * written by the buyer's browser and a buyer must not get to name the fee.
 */
export function platformFee(
  amount: number,
  isPro?: boolean | null,
  expiresAt?: string | null
): number {
  return Math.round((amount * platformFeePercent(isPro, expiresAt)) / 100);
}

/** First moment of the current month, UTC — the window both limits count in. */
export function monthStartISO(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}

/** A Pro subscription is active if the flag is set and not expired. */
export function isProActive(
  isPro?: boolean | null,
  expiresAt?: string | null
): boolean {
  if (!isPro) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt) > new Date();
}
