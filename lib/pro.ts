// LinkUpNaija Pro constants and helpers.

export const PRO_PRICE = 4999; // ₦4,999 / month
export const PRO_DAYS = 30;
// 3, not 5. In August 29 requests came from 17 people and the distribution
// was 8, 3, 2, 2, 2, then ones — so 5 and 3 bind on exactly the same single
// person, while 2 would have blocked the second and third most active users
// too. 3 costs nothing at today's volume and starts to matter as it grows.
export const FREE_REQUEST_LIMIT = 3; // join requests per month for free users
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
