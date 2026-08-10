/**
 * Detecting listings that send people off the platform to sign up.
 *
 * Plenty of events here tell you to register somewhere else — a form on the
 * organiser's own site, a WhatsApp number, "DM to register", "exact venue
 * shared after payment". Every one of those is a person who reads the listing,
 * leaves, and never makes an account, never joins the group chat, and has no
 * reason to come back. It's a plausible contributor to 2.2% week-1 retention.
 *
 * This module only DETECTS. Nothing here removes, hides or downranks an event
 * — the flags exist so the size and shape of the problem is visible before
 * anyone sets a policy on it.
 *
 * No imports on purpose: this file is run directly by the reporting script as
 * well as being used by the app.
 */

export type LeakKind =
  | "external-url"
  | "whatsapp"
  | "dm-to-register"
  | "phone-number"
  | "email-signup"
  | "offline-payment";

export interface Leak {
  kind: LeakKind;
  /** The matched text, for showing an admin what tripped it. */
  evidence: string;
}

export const LEAK_LABELS: Record<LeakKind, string> = {
  "external-url": "Links to an external site",
  whatsapp: "Sends people to WhatsApp",
  "dm-to-register": "Asks people to DM to register",
  "phone-number": "Gives a phone number to register",
  "email-signup": "Asks people to email to register",
  "offline-payment": "Takes payment off-platform",
};

/** Our own links aren't leaks, and neither are the usual social handles. */
const OWN_DOMAINS = /^(www\.)?(linkupnaija\.com|localhost)/i;

/**
 * Social profile links are excluded deliberately. "Follow us on Instagram" is
 * marketing, not a registration route — the harm we're measuring is losing
 * someone at the point they decide to attend.
 */
const SOCIAL_ONLY =
  /^(www\.)?(instagram\.com|facebook\.com|fb\.com|twitter\.com|x\.com|tiktok\.com|linkedin\.com|youtube\.com|youtu\.be)/i;

const URL_RE =
  /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,)]*)?)/gi;

/** 0803…, 234…, +234… — the shapes a Nigerian mobile number is written in. */
const PHONE_RE = /(?:\+?234|0)[789][01]\d{8}\b/g;

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

const WHATSAPP_RE =
  /\b(whats\s?app|wa\.me|chat\.whatsapp\.com|whatsapp\s+(?:us|me|to|line|group))\b/gi;

const DM_RE =
  /\b(dm\s+(?:to|us|me|for)|send\s+a\s+dm|slide\s+into|inbox\s+(?:us|me)|message\s+(?:us|me)\s+to|text\s+\w+\s+to)\b/gi;

const OFFLINE_PAY_RE =
  /\b(venue\s+(?:will\s+be\s+)?(?:shared|revealed|disclosed|sent)\s+after\s+payment|account\s+(?:number|details)\s*[:\-]|transfer\s+to\s+(?:this\s+)?account|pay\s+(?:to|into)\s+(?:the\s+)?account)\b/gi;

function firstMatches(text: string, re: RegExp, limit = 3): string[] {
  const out: string[] = [];
  // Fresh lastIndex each call — these are module-level /g regexes and would
  // otherwise resume mid-string on the next event and miss matches.
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < limit) out.push(m[0].trim());
  return out;
}

/**
 * Everything in a description that routes someone off the platform.
 *
 * Returns an empty array for a clean listing.
 */
export function detectLeaks(description: string | null | undefined): Leak[] {
  const text = (description ?? "").trim();
  if (!text) return [];

  const leaks: Leak[] = [];
  const seen = new Set<LeakKind>();
  const add = (kind: LeakKind, evidence: string) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    leaks.push({ kind, evidence });
  };

  for (const raw of firstMatches(text, URL_RE, 8)) {
    const host = raw.replace(/^https?:\/\//i, "");
    if (OWN_DOMAINS.test(host) || SOCIAL_ONLY.test(host)) continue;
    // "e.g" and "vol.2" look like domains to a permissive pattern; a real one
    // has a plausible TLD and something before the dot.
    if (!/\.(com|org|net|africa|ng|io|co|info|events|live|app|site|online|biz|tv|me)\b/i.test(host))
      continue;
    add("external-url", raw);
    break;
  }

  const wa = firstMatches(text, WHATSAPP_RE, 1);
  if (wa.length) add("whatsapp", wa[0]);

  const dm = firstMatches(text, DM_RE, 1);
  if (dm.length) add("dm-to-register", dm[0]);

  const phone = firstMatches(text, PHONE_RE, 1);
  if (phone.length) add("phone-number", phone[0]);

  const email = firstMatches(text, EMAIL_RE, 1);
  if (email.length) add("email-signup", email[0]);

  const pay = firstMatches(text, OFFLINE_PAY_RE, 1);
  if (pay.length) add("offline-payment", pay[0]);

  return leaks;
}

export function leaksOffPlatform(description: string | null | undefined): boolean {
  return detectLeaks(description).length > 0;
}
