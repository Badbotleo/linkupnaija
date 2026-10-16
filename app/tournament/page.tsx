import { redirect } from "next/navigation";

/**
 * FC26 is dead. The page is a redirect now.
 *
 * It advertised a two million naira prize, forty places and a ten thousand
 * naira entry fee, and it was never given a date: the countdown shipped as
 * <Countdown date={null} /> with a note to fill one in "once announced".
 *
 * NOBODY PAID. Checked directly against the database rather than through the
 * public key, because tournament_registrations returns a count of zero to
 * anon whether it is empty or whether RLS is hiding every row, and those are
 * very different facts when the question is "does somebody want their ten
 * thousand naira back". The real count is zero, so there is nothing owed and
 * nothing to apologise for on a page.
 *
 * Redirected rather than left up, because the link was printed on flyers
 * with a QR code on it. A promise with no date, still reachable, is worse
 * than a dead link: noindex hides it from search but not from anybody
 * holding the flyer.
 *
 * The full page, the countdown, the rules, the prize breakdown and the QR
 * block are in git at 2626181 if the tournament ever comes back. The
 * TournamentRegistration component and the tournament_registrations table
 * are untouched and still there.
 */
export default function TournamentPage() {
  redirect("/");
}
