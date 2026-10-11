import Link from "next/link";
import { getSessionUser, getCurrentUserMeta } from "@/lib/supabase/auth";
import MobileNav from "./MobileNav";
import { LogoMark } from "./Logo";
import StickyHeader from "./StickyHeader";
import { isProActive } from "@/lib/pro";

export default async function Navbar() {
  // Shared (request-cached) with the page being rendered — see lib/supabase/auth.
  const user = await getSessionUser();

  let isAdmin = false;
  let isTeam = false;
  let myName: string | null = null;
  let myAvatar: string | null = null;
  let isPro = false;
  if (user) {
    const meta = await getCurrentUserMeta();
    isAdmin = !!meta?.is_admin;
    isTeam = !!meta?.is_team;
    myName = meta?.name ?? null;
    myAvatar = meta?.avatar_url ?? null;
    isPro = isProActive(meta?.is_pro, meta?.pro_expires_at);
  }

  return (
    <StickyHeader className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <nav className="container-page flex h-16 items-center justify-between">
        {/* The mark alone on mobile. The wordmark is six characters of brand
            on a bar whose other job is a hamburger, and the mark already
            carries the name for anybody who has been here before. The
            wordmark is still on every desktop screen, every share card and
            every printed thing we make. */}
        <Link href="/" aria-label="LinkUpNaija home">
          <LogoMark size={34} pulse />
        </Link>

        {/* Right side: a few primary links on desktop + a hamburger menu that
            holds everything else, on every screen size. */}
        <div className="flex items-center gap-1 xl:gap-2">
          {/* There used to be a row of desktop links here, marked
              `hidden lg:flex` — inside a header marked `lg:hidden`. It could
              not render at any width, and DesktopRail has done that job for
              a while. It was still costing every signed-in page load an
              unread-messages count for a row nobody could see. */}
          {/* The message icon used to live here, beside the hamburger,
              because the bottom bar's five slots were spoken for. That held
              until this header started hiding on scroll and took the unread
              badge with it. Messages is now the bottom bar's Inbox tab,
              which is always visible and in the thumb zone. */}
          {/* Hamburger menu — all sizes */}
          <MobileNav
            userId={user?.id ?? null}
            isAdmin={isAdmin}
            isTeam={isTeam}
            name={myName}
            avatarUrl={myAvatar}
            isPro={isPro}
          />
        </div>
      </nav>
    </StickyHeader>
  );
}
