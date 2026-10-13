import Link from "next/link";
import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Creation at the head of the feed, not behind a tab.
 *
 * "Things to do this week" is this, wearing a costume: a shelf of ideas whose
 * every button says "Host it". It was sitting third on the home page and
 * outranking every real event on the platform to make the ask. A composer
 * makes the same ask in 72 pixels, at the top, where it costs nothing and
 * where people already expect to find it.
 */
export default function Composer({
  userId,
  avatarUrl,
  firstName,
}: {
  userId: string;
  avatarUrl: string | null;
  firstName: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[var(--e1)] dark:bg-white/[0.04]">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <GeneratedAvatar seed={userId} className="h-full w-full" />
          )}
        </span>
        <Link
          href="/host"
          className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[14.5px] text-gray-500 transition hover:bg-gray-200 dark:bg-white/[0.07] dark:hover:bg-white/10"
        >
          {firstName}, hosting anything this weekend?
        </Link>
      </div>

      <div className="mt-2.5 flex items-center gap-1 border-t border-gray-100 pt-2 dark:border-white/10">
        {[
          { href: "/host", icon: "mic", label: "Host" },
          { href: "/events", icon: "search", label: "Find" },
          { href: "/refer", icon: "gift", label: "Invite" },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13.5px] font-bold text-gray-600 transition hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/5"
          >
            <LineIcon name={a.icon} size={16} className="text-brand" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
