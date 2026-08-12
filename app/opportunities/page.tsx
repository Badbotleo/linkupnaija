import { redirect } from "next/navigation";

/**
 * Opportunities is Vendors now.
 *
 * It was a hub for listing your car, venue or services. The car moved to the
 * driver tab on /rides, and everything else IS a vendor — with a real
 * profile, photos of the work, a starting price and a way to be briefed,
 * rather than a form that collected fields nobody could browse.
 *
 * Kept as a redirect so shared links and the nav still land somewhere.
 */
export default function OpportunitiesPage() {
  redirect("/vendors");
}
