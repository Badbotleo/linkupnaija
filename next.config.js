/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["react-leaflet", "@react-leaflet/core"],
  images: {
    // Serve modern formats (much smaller than JPEG/PNG) and cache optimized
    // images at the edge for 30 days.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Tree-shake heavy package imports so only used code is bundled.
  experimental: {
    optimizePackageImports: ["framer-motion"],
    // The OG/Instagram cards read these at runtime via a path built from
    // process.cwd(), which the tracer can't follow — without this the fonts
    // are missing on Vercel and ₦ goes back to rendering as a tofu box.
    //
    // EVERY ROUTE THAT CALLS ogFonts() HAS TO BE LISTED HERE. Three of the
    // five were not, and the failure is invisible in development: the file
    // sits on disk locally, so the card renders, and it is only the deployed
    // lambda that has no fonts and answers 500. The weekly round-up card had
    // been broken in production this way while the per-event card beside it
    // worked, which is what made it look like a bug in the admin panel.
    //
    // grep -rl ogFonts app  is the list. Keep them in step.
    outputFileTracingIncludes: {
      "/api/ig-card/[id]": ["./assets/fonts/**"],
      "/api/ig-card/things": ["./assets/fonts/**"],
      "/api/ig-card/join": ["./assets/fonts/**"],
      "/api/ig-card/claim": ["./assets/fonts/**"],
      "/events/[id]/opengraph-image": ["./assets/fonts/**"],
    },
  },
};

module.exports = nextConfig;
