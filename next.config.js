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
    outputFileTracingIncludes: {
      "/api/ig-card/[id]": ["./assets/fonts/**"],
      "/events/[id]/opengraph-image": ["./assets/fonts/**"],
    },
  },
};

module.exports = nextConfig;
