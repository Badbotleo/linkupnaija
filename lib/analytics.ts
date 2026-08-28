/**
 * The handful of moments worth telling Google Ads about.
 *
 * GA4 was installed but only ever recorded pageviews, which meant paid traffic
 * could be counted and never graded: no way to tell a click that joined a
 * link-up from one that bounced, and nothing for a bidding strategy to
 * optimise toward. Every campaign type that learns — Performance Max, Demand
 * Gen, anything on conversion bidding — is unusable without this.
 *
 * Deliberately three events, not thirty. An analytics property full of
 * `button_clicked` is a property nobody reads. These are the three that mean
 * money or supply:
 *
 *   sign_up   — an account now exists
 *   join_lead — somebody asked to attend something (the real goal)
 *   purchase  — a ticket was paid for, with the value attached
 *
 * Import these as conversions in Google Ads once they have fired a few times.
 */

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: string, event: string, params?: Params) => void;
  }
}

/**
 * Never throws, never blocks.
 *
 * An ad blocker, a privacy extension, or a slow gtag.js all mean window.gtag
 * is simply absent — and a missing analytics call must never break a signup or
 * a join. This is the one place that decision is made, so no caller has to
 * remember it.
 */
export function track(event: string, params: Params = {}): void {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", event, params);
  } catch {
    /* analytics is never worth an exception on a path that matters */
  }
}

/** An account was created. Fires once, at creation, not at every login. */
export const trackSignUp = (method: "google" | "email" | "code") =>
  track("sign_up", { method });

/**
 * Somebody asked to attend. The conversion the ads are really buying.
 *
 * Called a lead rather than a conversion because on a free link-up no money
 * changes hands — but it is the moment a visitor becomes a person who turns up
 * somewhere, which is the thing the platform exists to cause.
 */
export const trackJoinLead = (eventId: string, free: boolean) =>
  track("join_lead", { event_id: eventId, free });

/**
 * A ticket was paid for. Value in naira so Google can optimise on revenue
 * rather than on the count of clicks that happened to convert.
 */
export const trackPurchase = (eventId: string, amountNaira: number) =>
  track("purchase", { event_id: eventId, currency: "NGN", value: amountNaira });
