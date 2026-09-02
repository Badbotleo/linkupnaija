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
 * Premium alone is NOT enough. The badge is sold as "somebody at LinkUpNaija
 * checked this person", and the moment it renders for anyone who has merely
 * paid, that sentence becomes false and the badge is worth less than nothing
 * on a platform whose safety model is hosts approving strangers.
 *
 * So it needs a live subscription AND an approved government ID. A lapsed
 * subscription hides the badge without un-verifying the person; a revoked
 * verification removes it while they are still paying.
 *
 * WITH ONE EXEMPTION, and it expires on its own. Members who were already
 * paying when the rule changed keep the badge until their term ends: they
 * bought it under different terms and did nothing wrong, and taking it back
 * mid-subscription would be a punishment for our change of mind.
 * `badge_grandfathered_until` is stamped once by
 * migration-badge-grandfather.sql and never written again, so the exemption
 * drains away by itself. After the last one lapses the badge means one thing.
 */
export function showsVerifiedBadge(
  isPro?: boolean | null,
  proExpiresAt?: string | null,
  idVerifiedAt?: string | null,
  grandfatheredUntil?: string | null
): boolean {
  if (!isProActive(isPro, proExpiresAt)) return false;
  if (idVerifiedAt) return true;
  return !!grandfatheredUntil && new Date(grandfatheredUntil) > new Date();
}
