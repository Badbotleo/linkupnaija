import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getCurrentUserMeta } from "@/lib/supabase/auth";
import NotificationsBell from "./NotificationsBell";
import ThemeToggle from "./ThemeToggle";
import MobileNav from "./MobileNav";
import Logo from "./Logo";

export default async function Navbar() {
  // Shared (request-cached) with the page being rendered — see lib/supabase/auth.
  const user = await getSessionUser();

  let isAdmin = false;
  let unreadMessages = 0;
  let myName: string | null = null;
  let myAvatar: string | null = null;
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
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="LinkUpNaija home">
          <Logo size={34} textClassName="text-lg" pulse />
        </Link>

        {/* Desktop navigation (lg and up) */}
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
            href="/venues"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Venues
          </Link>
          <Link
            href="/tournament"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Tournament
          </Link>
          <Link
            href="/host"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Host
          </Link>
          <Link
            href="/opportunities"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Opportunities
          </Link>

          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-1 xl:gap-2">
              <NotificationsBell userId={user.id} />
              <Link
                href="/friends"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                Friends
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-brand-50"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="relative rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                Dashboard
                {unreadMessages > 0 && (
                  <span className="absolute right-0 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-outline ml-1 py-2">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-outline py-2">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary py-2">
                Sign up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile / tablet top bar (below lg): theme, search, bell, hamburger */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gray-100">
            <ThemeToggle />
          </div>
          <Link
            href="/events"
            aria-label="Search events"
            className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>
          {user && (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gray-100">
              <NotificationsBell userId={user.id} />
            </div>
          )}
          <MobileNav
            userId={user?.id ?? null}
            isAdmin={isAdmin}
            name={myName}
            avatarUrl={myAvatar}
          />
        </div>
      </nav>
    </header>
  );
}
