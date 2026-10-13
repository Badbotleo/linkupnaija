import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import type { FriendUser } from "@/lib/types";

/**
 * Faces, then the sentence. The single highest-value line on a feed card and
 * the one thing the shelved home page shows nowhere.
 *
 * Overlapping avatars rather than a count, because a row of faces is read
 * before it is parsed: you recognise your own people at a glance and the
 * sentence underneath only confirms it.
 */
export default function FriendsGoing({
  friends,
  line,
}: {
  friends: FriendUser[];
  line: string;
}) {
  if (friends.length === 0) return null;
  const shown = friends.slice(0, 4);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex shrink-0">
        {shown.map((f, i) => (
          <span
            key={f.id}
            className="relative -ml-2 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white first:ml-0 dark:ring-[#1a1a1a]"
            style={{ zIndex: shown.length - i }}
          >
            {f.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={f.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <GeneratedAvatar seed={f.id} className="h-full w-full" />
            )}
          </span>
        ))}
      </div>
      <p className="min-w-0 truncate text-[13px] font-semibold text-gray-700">
        {line}
      </p>
    </div>
  );
}
