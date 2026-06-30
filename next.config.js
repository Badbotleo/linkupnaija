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
  },
};

module.exports = nextConfig;
