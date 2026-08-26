import { redirect } from "next/navigation";
import ScanRedirect from "@/components/ScanRedirect";

/**
 * Poster and sticker landing codes.
 *
 * A QR scan carries no referrer, and VisitRecorder strips the query string
 * before recording, so ?ref=poster is thrown away and every scan looks like
 * somebody typing the address. Paths ARE recorded, so each print batch gets
 * one of these and shows up as its own row in the admin Top Pages list. That
 * row count is the scan count, and it is the only reason the A/B between the
 * two poster hooks can be read at all.
 *
 * Not a database table on purpose. The path is the record; there is nothing
 * to keep in sync and nothing to migrate when a new batch goes out.
 */
const DESTINATIONS: Record<string, string> = {
  // Lagos street posters. Landing on the state-filtered feed rather than the
  // national one, because somebody standing in front of a pole in Yaba is not
  // looking for a road trip leaving Calabar.
  lag1: `/events?state=${encodeURIComponent("Lagos")}`,
  lag2: `/events?state=${encodeURIComponent("Lagos")}`,
  abj1: `/events?state=${encodeURIComponent("FCT - Abuja")}`,
  abj2: `/events?state=${encodeURIComponent("FCT - Abuja")}`,
  // Campus sheets lead with the referral, so they land on the signup page
  // that explains it rather than the feed, which never mentions money. The
  // offer needs an account to exist, so signup first is the honest order here
  // even though every other route into the product browses first.
  abj3: "/join",
  lag3: "/join",
  // Stickers travel, so they stay national.
  stk: "/events",
};

const FALLBACK = "/events";

/** Codes are printed by hand onto artwork; keep the shape boring. */
const VALID = /^[a-z0-9-]{1,24}$/;

// These are redirects, not content. Indexing them would put a tracking URL in
// the search results in place of the page it forwards to.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function ScanPage({ params }: { params: { code: string } }) {
  const code = (params.code ?? "").toLowerCase();

  // A malformed code is somebody poking at the URL, not a scan. Send them on
  // without writing a row for it.
  if (!VALID.test(code)) redirect(FALLBACK);

  // An unknown but well-formed code still counts and still works. A batch can
  // go to print before the destination for it is deployed, and the worst case
  // is that it lands on the national feed.
  return <ScanRedirect code={code} dest={DESTINATIONS[code] ?? FALLBACK} />;
}
