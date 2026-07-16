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
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
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
