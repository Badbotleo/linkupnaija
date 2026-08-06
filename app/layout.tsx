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
  if (user) {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    unread = count ?? 0;
  }

  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Clears the stale theme flag before paint. The dark toggle was
            removed on 5 Aug because only 6 of 194 components supported it —
            without this, anyone who had switched it on would be stuck in a
            half-dark app forever, with no toggle left to switch it back.
            Restore the original read when dark mode is genuinely finished. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.removeItem('theme');document.documentElement.classList.remove('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <ScrollProgress />
        <NavProgress />
        <DesktopRail isLoggedIn={!!user} unread={unread} />
        <Navbar />
        {/* pb clears the mobile bottom nav */}
        <main className="flex-1 pb-16 lg:pb-0 lg:pl-[248px]">{children}</main>
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
