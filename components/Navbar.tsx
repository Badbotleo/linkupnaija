import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getCurrentUserMeta } from "@/lib/supabase/auth";
import NotificationsBell from "./NotificationsBell";
import ThemeToggle from "./ThemeToggle";
import MobileNav from "./MobileNav";
import Logo from "./Logo";
import { isProActive } from "@/lib/pro";

export default async function Navbar() {
  // Shared (request-cached) with the page being rendered — see lib/supabase/auth.
  const user = await getSessionUser();

  let isAdmin = false;
  let unreadMessages = 0;
  let myName: string | null = null;
  let myAvatar: string | null = null;
  let isPro = false;
  if (user) {
    const supabase = createClient();
    const [meta, { count }] = await Promise.all([
      getCurrentUserMeta(),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false),
    ]);
    isAdmin = !!meta?.is_admin;
    unreadMessages = count ?? 0;
    myName = meta?.name ?? null;
    myAvatar = meta?.avatar_url ?? null;
    isPro = isProActive(meta?.is_pro, meta?.pro_expires_at);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <nav className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="LinkUpNaija home">
          <Logo size={34} textClassName="text-lg" pulse />
        </Link>

        {/* Right side: a few primary links on desktop + a hamburger menu that
            holds everything else, on every screen size. */}
        <div className="flex items-center gap-1 xl:gap-2">
          {/* Primary links (lg and up) */}
          <div className="hidden items-center gap-1 lg:flex xl:gap-2">
            <Link
              href="/events"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Explore
            </Link>
            <Link
              href="/circles"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Circles
            </Link>
            <Link
              href="/host"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Host
            </Link>
            <Link
              href="/hosts/leaderboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Leaderboard
            </Link>

            <ThemeToggle />

            {user ? (
              <>
                <NotificationsBell userId={user.id} />
                {/* The count belongs on Messages now that Messages exists.
                    On Dashboard it was a red dot pointing at a page that only
                    contained the thing you wanted. */}
                <Link
                  href="/messages"
                  className="relative rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Messages
                  {unreadMessages > 0 && (
                    <span className="absolute right-0 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-outline py-2">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary py-2">
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Messages, on every screen, one tap.
              They lived at the bottom of /dashboard, which meant reading a DM
              started with opening a page you did not want and scrolling past
              your link-ups. The bottom bar's five slots are spoken for, so
              this sits where Instagram puts it: the top bar, beside the menu,
              with the count on it. */}
          {user && (
            <Link
              href="/messages"
              aria-label={
                unreadMessages > 0
                  ? `Messages, ${unreadMessages} unread`
                  : "Messages"
              }
              className="relative grid h-10 w-10 place-items-center rounded-full text-gray-700 transition hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/10"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5A8.4 8.4 0 0 1 21 11.5z" />
              </svg>
              {unreadMessages > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#121212]">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          )}

          {/* Hamburger menu — all sizes */}
          <MobileNav
            userId={user?.id ?? null}
            isAdmin={isAdmin}
            name={myName}
            avatarUrl={myAvatar}
            isPro={isPro}
          />
        </div>
      </nav>
    </header>
  );
}
