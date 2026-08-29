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
