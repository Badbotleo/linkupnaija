import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/qr";

/**
 * There was no robots.txt at all, which meant crawlers were free to spend
 * their budget on /dashboard and /login — pages that need a session and
 * return nothing useful to a logged-out crawler.
 *
 * Disallow is not a security control. Everything listed here is already
 * behind auth; this only stops Google wasting crawls and reporting soft-404s
 * on pages it was never going to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/profile",
          "/settings",
          "/tickets",
          "/login",
          "/signup",
          // Query-string variants of the same listings. Without this Google
          // indexes /events?category=Party as its own page and then reports
          // it as a duplicate of /events.
          "/events?",
          "/venues?",
          // Poster scan codes. They forward to /events, so indexing one would
          // put a tracking URL in the results in place of the real page.
          "/p/",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
