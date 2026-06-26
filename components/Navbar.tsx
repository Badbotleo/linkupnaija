import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationsBell from "./NotificationsBell";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

export default async function Navbar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let unreadMessages = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("users").select("is_admin").eq("id", user.id).single(),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false),
    ]);
    isAdmin = !!profile?.is_admin;
    unreadMessages = count ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="LinkUpNaija home">
          <Logo size={34} textClassName="text-lg" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/events"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Explore
          </Link>
          <Link
            href="/venues"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Venues
          </Link>
          <Link
            href="/host"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Host
          </Link>

          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationsBell userId={user.id} />
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
      </nav>
    </header>
  );
}
