/**
 * What a notification is about, worked out from what it says.
 *
 * Every row in the alerts list drew the same bell in the same brand-tinted
 * disc, so a friend request, a payout, a ticket sale and "somebody shared an
 * event in your circle" were visually identical and the list could only be
 * read one line at a time. It is the same defect as the sparkle that sat on
 * every event card: an icon that never varies is decoration, not information.
 *
 * NO TYPE COLUMN TO KEY OFF. The notifications table carries a message, an
 * optional link and an optional event id, and nothing else; the rows are
 * written by database triggers in several migrations. Adding a type column
 * would mean backfilling every existing row from the same strings this reads,
 * so it reads the strings and skips the migration.
 *
 * Ordered by how specific the match is. Money before the generic request
 * wording, because "Your withdrawal request" contains "request" and is not a
 * join request. The link is consulted first where it is unambiguous.
 */

export interface NotificationKind {
  /** A LineIcon name. */
  icon: string;
  /** Tailwind classes for the disc, so money does not look like a mention. */
  tone: string;
}

const BRAND = "bg-brand-50 text-brand dark:bg-brand/20";
const GOOD = "bg-naija/[0.12] text-naija-700 dark:text-naija-200";
const WARM = "bg-amber-400/[0.16] text-amber-700 dark:text-amber-300";
const QUIET = "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/60";

export function notificationKind(
  message: string,
  link?: string | null
): NotificationKind {
  const m = message.toLowerCase();
  const l = (link ?? "").toLowerCase();

  // Money first. These strings contain "request" and must not fall through
  // to the join-request rule below.
  if (
    /withdraw|payout|paid|payment|refund|wallet|₦/.test(m) ||
    l.startsWith("/wallet")
  ) {
    return { icon: "gift", tone: GOOD };
  }

  if (/friend request|accepted your friend|now friends/.test(m) || l.startsWith("/friends")) {
    return { icon: "users", tone: BRAND };
  }

  if (/\bride\b|driver|pickup/.test(m) || l.startsWith("/rides")) {
    return { icon: "car", tone: WARM };
  }

  if (/message|replied|said/.test(m) || l.startsWith("/messages")) {
    return { icon: "chat", tone: BRAND };
  }

  if (/photo|picture|gallery|recap/.test(m)) {
    return { icon: "camera", tone: BRAND };
  }

  if (/review|rated|rating|stars?\b/.test(m)) {
    return { icon: "star", tone: WARM };
  }

  if (/ticket|sold|seat/.test(m)) {
    return { icon: "ticket", tone: GOOD };
  }

  if (/circle/.test(m) || l.startsWith("/circles")) {
    return { icon: "circles", tone: BRAND };
  }

  // Somebody wants in, or you are in. Both are about people and an event,
  // but one needs a decision and the other is just news, so they differ.
  if (/request to join|wants to join|review the request|asked to join/.test(m)) {
    return { icon: "key", tone: WARM };
  }
  if (/approved|accepted|you're going|confirmed|going to/.test(m)) {
    return { icon: "check", tone: GOOD };
  }
  if (/declined|rejected|cancelled|canceled|full/.test(m)) {
    return { icon: "x", tone: QUIET };
  }

  if (/new event|shared in|hosting|starts|reminder|tomorrow|today/.test(m)) {
    return { icon: "calendar", tone: BRAND };
  }

  if (/venue|reservation|booked/.test(m)) {
    return { icon: "pin", tone: WARM };
  }

  // A bell is the right answer for a notification nothing else describes. It
  // is the wrong answer for all of them.
  return { icon: "bell", tone: QUIET };
}
