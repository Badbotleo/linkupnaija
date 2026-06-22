// Helpers for normalizing and reading social links.

import type { PublicProfile } from "./types";

/** Turn an Instagram handle (or URL) into a full profile URL, or null. */
export function normalizeInstagram(input: string): string | null {
  const handle = input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

/** Turn an X/Twitter handle (or URL) into a full profile URL, or null. */
export function normalizeTwitter(input: string): string | null {
  const handle = input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
    .replace(/\/+$/, "");
  return handle ? `https://x.com/${handle}` : null;
}

/** Ensure a Facebook profile URL has a scheme, or null. */
export function normalizeFacebook(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

/** Read the last path segment of a social URL as a display handle. */
export function handleFromUrl(url: string | null): string | null {
  if (!url) return null;
  const cleaned = url.replace(/\/+$/, "");
  const seg = cleaned.split("/").pop();
  return seg ? `@${seg}` : null;
}

/** A profile is "socially verified" if it has at least one social link. */
export function hasSocialLinks(
  p: Pick<PublicProfile, "instagram_url" | "twitter_url" | "facebook_url">
): boolean {
  return !!(p.instagram_url || p.twitter_url || p.facebook_url);
}
