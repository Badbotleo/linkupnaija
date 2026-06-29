import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import ScrollProgress from "@/components/ScrollProgress";
import NavProgress from "@/components/NavProgress";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "LinkUpNaija — Connect. Hang out. Vibe.";
const DESCRIPTION =
  "Nigeria's social events platform. Find clubbing, parties, picnics, book clubs, dinners and game nights near you — or host your own.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · LinkUpNaija",
  },
  description: DESCRIPTION,
  applicationName: "LinkUpNaija",
  keywords: [
    "Nigeria events",
    "Lagos events",
    "parties",
    "clubbing",
    "picnic",
    "book club",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <ScrollProgress />
        <NavProgress />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
      <GoogleAnalytics gaId="G-4YZV5789P8" />
    </html>
  );
}
