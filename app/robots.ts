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
          // NOT listed here, deliberately, and it took a Search Console
          // warning to notice: "/events?", "/venues?" and "/p/".
          //
          // robots.txt controls CRAWLING, not indexing. Google still finds a
          // blocked URL through links to it, and having been forbidden to
          // fetch the page, indexes the bare URL with nothing behind it. That
          // is the "Indexed, though blocked by robots.txt" report, and it is
          // strictly worse than not blocking at all.
          //
          // /p/ was the sharpest version: those pages already declare
          // robots: { index: false }, and blocking them meant Google could
          // never read the very instruction that would have kept them out.
          // The poster QR codes get scanned and shared, so it found them
          // anyway.
          //
          // Query variants are handled by a canonical on /events and /venues
          // instead, which needs the crawl to work.
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
