import AttendeeChips from "../AttendeeChips";
import LineIcon from "../ui/LineIcon";
import { ATTENDANCE_REVEAL_AT } from "@/lib/social-proof";

/**
 * Who's going, led by the reason it's worth knowing.
 *
 * Every events app has a guest list. Almost none of them can say the guests
 * were let in one at a time by a person — that's the thing this product
 * actually does differently, and it was nowhere on the page. The list sat
 * under a plain "Who's going" heading, which reads as a number rather than a
 * promise.
 *
 * The empty state mattered more than the full one. "No one yet. Be the first
 * to join! 🎈" is the same deflating zero the rest of the app stopped showing
 * months of work ago, dressed in a balloon: it tells a stranger the room is
 * empty at the exact moment they were deciding. Being first is only worth
 * saying when it sounds like an invitation, so that's what it says now — and
 * the approval promise carries the block instead of the count.
 */
interface Guest {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  gender?: string | null;
  isHost?: boolean;
}

export default function ApprovedGuests({
  guests,
  count,
  friendIds = [],
}: {
  guests: Guest[];
  count: number;
  friendIds?: string[];
}) {
  const reveal = count >= ATTENDANCE_REVEAL_AT;

  return (
    <div>
      <div className="flex items-start gap-3 rounded-2xl border border-brand/15 bg-brand/[0.04] p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <LineIcon name="shield" size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-tight text-gray-900">
            The host approves every guest
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-gray-600">
            {count === 0
              ? "Ask to join and you'll be first through the door."
              : reveal
                ? `${count} ${count === 1 ? "person is" : "people are"} approved so far. You'll see exactly who before you go.`
                : "You'll see exactly who's coming before you go."}
          </p>
        </div>
      </div>

      {/* Faces only once there are enough of them to read as a room. Below
          that the promise above is the stronger thing to show. */}
      {count > 0 && (
        <div className="mt-3">
          <AttendeeChips attendees={guests} friendIds={friendIds} />
        </div>
      )}
    </div>
  );
}
