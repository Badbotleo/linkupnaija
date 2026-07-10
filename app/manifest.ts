import type { MetadataRoute } from "next";

// PWA manifest — makes the site installable on Android/iOS home screens
// ("Install app" banner + standalone window). Next serves this at
// /manifest.webmanifest and links it in <head> automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkUpNaija",
    short_name: "LinkUpNaija",
    description:
      "Nigeria's platform for real connection. Find hangouts, picnics, book clubs, game nights and more near you — or host your own.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1A1040",
    theme_color: "#534AB7",
    categories: ["social", "events", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
