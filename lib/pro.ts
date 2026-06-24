// LinkUpNaija Pro constants and helpers.

export const PRO_PRICE = 9900; // ₦9,900 / month
export const PRO_DAYS = 30;
export const FREE_REQUEST_LIMIT = 5; // join requests per month for free users

/** A Pro subscription is active if the flag is set and not expired. */
export function isProActive(
  isPro?: boolean | null,
  expiresAt?: string | null
): boolean {
  if (!isPro) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt) > new Date();
}
