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
 * The platform fee helpers that used to live here are gone as of 1 Sep 2026.
 *
 * The booking fee moved onto the buyer at a flat 9% for everybody, so there is
 * no host-side fee for Pro to halve. See lib/pricing.ts, which is now the only
 * place that decides what a ticket costs.
 */

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

/**
 * Whether the gold badge should show.
 *
 * An active subscription, and nothing else. The badge means "Premium member",
 * which is a true statement about somebody who pays, and it is the only claim
 * this platform can currently stand behind.
 *
 * ID VERIFICATION IS SHELVED, NOT ABANDONED. The code is written and the
 * migration is in supabase/migration-id-verification.sql, deliberately unrun.
 * Asking somebody for a NIN and a selfie on a platform of 108 members is a
 * bigger ask than it sounds in Nigeria, and the review queue is a standing
 * obligation nobody has time for yet. It cost a real customer on 6 Sep 2026:
 * she paid ₦4,999, the badge required a check she could not take because the
 * table did not exist, and she got nothing.
 *
 * Revisit around a thousand members. Below that a small community does this by
 * recognition; above it a trust signal starts doing real work, and the review
 * load justifies a provider rather than a person.
 *
 * The important part is what the badge CLAIMS in the meantime. A gold seal
 * saying "Premium member" is honest. The same seal labelled "Verified" while
 * it only means "paid" is the thing that would damage this product, because
 * hosts would work it out and the signal would be worth less than none.
 */
export function showsVerifiedBadge(
  isPro?: boolean | null,
  proExpiresAt?: string | null
): boolean {
  return isProActive(isPro, proExpiresAt);
}
