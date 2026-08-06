import type { MetadataRoute } from "next";

/**
 * Without this the site cannot be installed to a home screen — which, after
 * building everything else to feel native, was the one thing standing between
 * "app-like" and an actual app.
 *
 * `standalone` is what removes the browser chrome once installed: no URL bar,
 * no back/forward, just the product.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkUpNaija",
    short_name: "LinkUpNaija",
    description:
      "Find link-ups near you this week, ask to join, and turn up knowing who else will be there.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the app background so the splash doesn't flash white on open.
    background_color: "#F7F7F9",
    theme_color: "#1A1040",
    lang: "en-NG",
    categories: ["social", "lifestyle", "events"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        // "any maskable" lets Android crop it into whatever shape the launcher
        // uses without clipping the mark, because it sits on a filled square.
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      { name: "Explore link-ups", url: "/events" },
      { name: "Host a link-up", url: "/host" },
      { name: "Things to do", url: "/things-to-do" },
    ],
  };
}
