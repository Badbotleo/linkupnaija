import { createClient } from "@/lib/supabase/server";
import { safeUrl } from "@/lib/partners";

/**
 * Vendors: the people a host hires to make an event happen.
 *
 * Hosting is the hard part of this platform, and most of the hard part is
 * logistics — who's doing the food, who's bringing the drinks, who's shooting
 * it. Every one of those is currently a WhatsApp group and a prayer.
 *
 * Enquiries stay on platform. The same rule that keeps phone numbers out of
 * event descriptions applies here: a marketplace whose first action is
 * "here's my number" is a directory, and neither side ends up with a record
 * of what was agreed.
 */

export const VENDOR_CATEGORIES = [
  "Food",
  "Small Chops",
  "Grills & Suya",
  "Pastries & Cakes",
  "Drinks & Bar",
  "Cocktails",
  "Shisha",
  "Decor",
  "Photography",
  "Videography",
  "DJ",
  "Live Band",
  "MC / Host",
  "Makeup",
  "Ushers",
  "Rentals",
  "Security",
  "Cleaning",
  "Transport",
  "Venue",
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export interface Vendor {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  about: string | null;
  state: string | null;
  priceFrom: number | null;
  logoUrl: string | null;
  galleryUrls: string[];
  isVerified: boolean;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  about: string | null;
  state: string | null;
  price_from: number | null;
  logo_url: string | null;
  gallery_urls: string[] | null;
  is_verified: boolean;
}

const SELECT =
  "id, slug, name, category, tagline, about, state, price_from, logo_url, gallery_urls, is_verified";

function toVendor(r: Row): Vendor {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    tagline: r.tagline,
    about: r.about,
    state: r.state,
    priceFrom: r.price_from,
    logoUrl: safeUrl(r.logo_url),
    galleryUrls: (r.gallery_urls ?? [])
      .map(safeUrl)
      .filter((u): u is string => !!u),
    isVerified: r.is_verified,
  };
}

export async function listVendors(opts: {
  category?: string;
  state?: string;
  q?: string;
} = {}): Promise<Vendor[]> {
  const supabase = createClient();
  let query = supabase
    .from("vendors")
    .select(SELECT)
    .eq("is_active", true)
    // Vetted vendors first: the whole point of verifying is that it counts
    // for something at the moment somebody is choosing.
    .order("is_verified", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.state) query = query.eq("state", opts.state);
  if (opts.q?.trim()) {
    const term = opts.q.trim().replace(/[(),]/g, " ");
    query = query.or(
      `name.ilike.%${term}%,tagline.ilike.%${term}%,about.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  // A missing table means no vendors, not a broken page.
  if (error) return [];
  return ((data ?? []) as Row[]).map(toVendor);
}

export async function getVendor(slug: string): Promise<Vendor | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select(SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return toVendor(data as Row);
}

/**
 * A face for each category.
 *
 * A vendor with no photos yet was a grey box with a briefcase icon, and a
 * directory of grey boxes is a directory nobody browses. The category
 * carries the card until they upload their work.
 */
export const VENDOR_EMOJI: Record<string, string> = {
  Food: "🍲",
  "Small Chops": "🍢",
  "Grills & Suya": "🍖",
  "Pastries & Cakes": "🍰",
  "Drinks & Bar": "🍾",
  Cocktails: "🍹",
  Shisha: "💨",
  Decor: "🎈",
  Photography: "📸",
  Videography: "🎬",
  DJ: "🎧",
  "Live Band": "🎷",
  "MC / Host": "🎤",
  Makeup: "💄",
  Ushers: "🎀",
  Rentals: "🪑",
  Security: "🛡️",
  Cleaning: "🧹",
  Transport: "🚐",
  Venue: "🏛️",
};

/** Tailwind gradient per category, for the same reason. */
export const VENDOR_GRADIENT: Record<string, string> = {
  Food: "from-orange-500 to-red-600",
  "Small Chops": "from-amber-500 to-orange-600",
  "Grills & Suya": "from-red-600 to-rose-700",
  "Pastries & Cakes": "from-pink-400 to-rose-500",
  "Drinks & Bar": "from-purple-500 to-indigo-600",
  Cocktails: "from-fuchsia-500 to-pink-600",
  Shisha: "from-slate-500 to-slate-700",
  Decor: "from-sky-400 to-blue-600",
  Photography: "from-gray-700 to-gray-900",
  Videography: "from-zinc-700 to-neutral-900",
  DJ: "from-violet-500 to-purple-700",
  "Live Band": "from-amber-600 to-yellow-700",
  "MC / Host": "from-brand-500 to-brand-700",
  Makeup: "from-rose-400 to-pink-600",
  Ushers: "from-teal-400 to-cyan-600",
  Rentals: "from-stone-500 to-stone-700",
  Security: "from-slate-600 to-gray-800",
  Cleaning: "from-emerald-400 to-teal-600",
  Transport: "from-blue-500 to-indigo-700",
  Venue: "from-naija-500 to-emerald-700",
};
