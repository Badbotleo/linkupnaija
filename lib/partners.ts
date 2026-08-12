import { createClient } from "@/lib/supabase/server";

/**
 * Partner pages — venues and brands we run things with.
 *
 * Built as a system rather than a DEFCON page, because the second partner
 * should cost a database row and not a deploy. Everything that makes a page
 * look like theirs — colours, logo, cover, copy — is data.
 */

export interface Partner {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string | null;
  accentColor: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  state: string | null;
  /** The collaboration headline, when one is running. */
  collabBlurb: string | null;
}

/** Hex only. A partner-supplied value goes straight into a style attribute,
    so anything that isn't exactly #rrggbb is dropped rather than trusted. */
const HEX = /^#[0-9a-fA-F]{6}$/;
export function safeColor(v: string | null | undefined, fallback: string) {
  return v && HEX.test(v) ? v : fallback;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  accent_color: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  state: string | null;
  collab_blurb: string | null;
}

const SELECT =
  "id, slug, name, tagline, about, logo_url, cover_url, brand_color, accent_color, instagram, tiktok, website, state, collab_blurb";

function toPartner(r: Row): Partner {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    about: r.about,
    logoUrl: r.logo_url,
    coverUrl: r.cover_url,
    brandColor: r.brand_color,
    accentColor: r.accent_color,
    instagram: r.instagram,
    tiktok: r.tiktok,
    website: r.website,
    state: r.state,
    collabBlurb: r.collab_blurb,
  };
}

export async function getPartner(slug: string): Promise<Partner | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partners")
    .select(SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  // Null on error too: a missing table should render "not found", not a crash.
  if (error || !data) return null;
  return toPartner(data as Row);
}

export async function listPartners(): Promise<Partner[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partners")
    .select(SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];
  return ((data ?? []) as Row[]).map(toPartner);
}

/**
 * The price range across everything a partner is selling.
 *
 * "From ₦15,000" is the question people actually arrive with, and answering
 * it up front saves them opening three events to find out. Null when nothing
 * is priced — a range of ₦0 tells nobody anything.
 */
export async function getPartnerPriceRange(
  partnerId: string
): Promise<{ min: number; max: number; count: number } | null> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: eventRows } = await supabase
    .from("events")
    .select("id")
    .eq("partner_id", partnerId)
    .gte("date", today);
  const ids = (eventRows ?? []).map((e) => e.id as string);
  if (ids.length === 0) return null;

  const { data, error } = await supabase
    .from("ticket_tiers")
    .select("price")
    .in("event_id", ids)
    .eq("is_active", true)
    .gt("price", 0);
  if (error || !data || data.length === 0) return null;
  const prices = data.map((r) => r.price as number);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

/** Upcoming events for a partner, soonest first. */
export async function getPartnerEvents(partnerId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("id, title, category, date, time, location, state, price, cover_image_url")
    .eq("partner_id", partnerId)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(12);
  if (error) return [];
  return data ?? [];
}
