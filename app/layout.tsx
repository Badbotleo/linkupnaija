import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import DesktopRail from "@/components/DesktopRail";
import DeferredWidgets from "@/components/DeferredWidgets";
import ScrollProgress from "@/components/ScrollProgress";
import NavProgress from "@/components/NavProgress";
import Toaster from "@/components/Toaster";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import VisitRecorder from "@/components/VisitRecorder";
import { getVisitorState } from "@/lib/visitor-geo";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "LinkUpNaija · Find your people. Build real connections.";
const DESCRIPTION =
  "Nigeria's platform for real connection. Find family hangouts, friend reunions, picnics, book clubs, game nights and more near you, or host your own.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#534AB7",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · LinkUpNaija",
  },
  description: DESCRIPTION,
  applicationName: "LinkUpNaija",
  // iOS: launch full-screen from the home-screen icon (no Safari chrome).
  appleWebApp: {
    capable: true,
    title: "LinkUpNaija",
    statusBarStyle: "black-translucent",
  },
  keywords: [
    "Nigeria events",
    "family hangout",
    "friend reunion",
    "meet new people",
    "book club",
    "picnic",
    "game night",
    "hangouts",
    "LinkUpNaija",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "LinkUpNaija",
    type: "website",
    locale: "en_NG",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  let unread = 0;
  let isAdmin = false;
  if (user) {
    const supabase = createClient();
    // Both in one round trip — the rail needs the admin flag to know whether
    // to show the Admin row, and previously only the top navbar knew.
    const [{ count }, { data: me }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
      supabase.from("users").select("is_admin").eq("id", user.id).single(),
    ]);
    unread = count ?? 0;
    isAdmin = !!me?.is_admin;
  }

  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Resolves the theme BEFORE first paint, so nobody sees a white
            flash and then the app going dark.
            
            Three states, not two. "system" is the default and the one iOS
            users expect: the app follows the phone, including when the phone
            flips at sunset. An explicit choice overrides it and sticks.

            This replaces a kill-switch added on 5 Aug that deleted the theme
            on every load. The note said only 6 of 194 components supported
            dark — but the support was never per-component: globals.css
            overrides bg-white, bg-gray-*, text-gray-*, border-gray-* and the
            input/button primitives under .dark, so the whole app was already
            covered by 26 global rules. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <ScrollProgress />
        <NavProgress />
        <DesktopRail isLoggedIn={!!user} unread={unread} isAdmin={isAdmin} />
        <Navbar />
        {/* pb clears the mobile bottom nav */}
        <main className="flex-1 lg:pl-[248px]">{children}</main>
        {/* Counts a visit once per browser per page per day. Renders nothing. */}
        <VisitRecorder state={getVisitorState()} />
        <div className="lg:pl-[248px]">
          <Footer />
        </div>
        <DeferredWidgets />
        <BottomNav isLoggedIn={!!user} unread={unread} />
        <Toaster />
      </body>
      <GoogleAnalytics gaId="G-4YZV5789P8" />
    </html>
  );
}
