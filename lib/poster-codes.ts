/**
 * Printed scan codes, and what each one means.
 *
 * One place on purpose. The /p/<code> route needs the destination and the
 * admin analytics page needs a human label, and a code whose meaning is
 * recorded in two files is a code that eventually means two different things.
 *
 * A code is not deleted once printed. Sheets stay on walls for months and the
 * scans keep arriving; removing an entry here only makes the route fall back
 * to the national feed and the dashboard show a bare code.
 */
export interface PosterCode {
  /** Where a scan lands. */
  dest: string;
  /** How it reads in the admin dashboard. */
  label: string;
}

export const POSTER_CODES: Record<string, PosterCode> = {
  // Abuja street posters. Landing on the state-filtered feed rather than the
  // national one, because somebody standing at a pole in Wuse is not looking
  // for a road trip leaving Calabar.
  abj1: {
    dest: `/events?state=${encodeURIComponent("FCT - Abuja")}`,
    label: "Abuja · Bored this weekend?",
  },
  abj2: {
    dest: `/events?state=${encodeURIComponent("FCT - Abuja")}`,
    label: "Abuja · Find your people",
  },
  lag1: {
    dest: `/events?state=${encodeURIComponent("Lagos")}`,
    label: "Lagos · Bored this weekend?",
  },
  lag2: {
    dest: `/events?state=${encodeURIComponent("Lagos")}`,
    label: "Lagos · Find your people",
  },
  // Campus sheets lead with the referral, so they land on the signup page that
  // explains it rather than the feed, which never mentions money.
  abj3: { dest: "/join", label: "Abuja campus · Bring a paddy" },
  lag3: { dest: "/join", label: "Lagos campus · Bring a paddy" },
  // Stickers travel, so they stay national.
  stk: { dest: "/events", label: "Sticker" },
};

/** Where an unknown but well-formed code goes. */
export const POSTER_FALLBACK = "/events";
