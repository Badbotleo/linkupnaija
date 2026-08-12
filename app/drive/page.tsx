import { redirect } from "next/navigation";

/**
 * Driving is a tab on /rides now.
 *
 * Getting a ride and listing your car are the same subject, and splitting
 * them across two pages meant "I have a car" had three front doors — here,
 * a card on /rides, and a hub on /opportunities — none of which was where
 * anyone looked. Kept as a redirect so existing links and anything already
 * shared still land somewhere sensible.
 */
export default function DrivePage() {
  redirect("/rides?tab=drive");
}
