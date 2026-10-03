/**
 * How long ago somebody was here, said the same way everywhere.
 *
 * One function rather than a formatter per surface, because presence that
 * reads "Online now" on a profile and "active 2m ago" in a guest list looks
 * like two different features to the person reading it.
 *
 * ONLINE IS FIVE MINUTES. last_seen_at is written at most once every two
 * minutes, so a window any tighter would show somebody as offline while they
 * are mid-scroll. Five is the smallest number that cannot lie in that
 * direction.
 */

const ONLINE_MS = 5 * 60_000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS;
}

/**
 * Returns null when there is nothing honest to say.
 *
 * A member who signed up before last_seen_at existed, or who has never
 * loaded a page since, has no value here. "Last seen: never" is worse than
 * silence: it reads as a judgement on them rather than a gap in our data.
 */
export function lastSeenLabel(
  lastSeenAt: string | null | undefined
): string | null {
  if (!lastSeenAt) return null;

  const then = new Date(lastSeenAt).getTime();
  if (Number.isNaN(then)) return null;

  const mins = Math.floor((Date.now() - then) / 60_000);

  // A clock skew between the browser and the database can put this slightly
  // in the future. "Last seen in 1 minute" is the kind of thing people
  // screenshot, so anything negative is treated as now.
  if (mins < 5) return "Online now";
  if (mins < 60) return `Last seen ${mins} minutes ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Last seen ${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Last seen ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }

  // Past a month, the month name is more use than "Last seen 94 days ago",
  // which nobody converts into anything.
  return `Last seen in ${new Date(then).toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "Africa/Lagos",
  })}`;
}
