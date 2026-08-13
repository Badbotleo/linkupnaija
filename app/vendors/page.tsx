import { redirect } from "next/navigation";

/**
 * Vendors is built but parked.
 *
 * A marketplace with nothing in it is worse than no marketplace: the first
 * host who opens it finds an empty grid and never comes back to check. The
 * browse page, the profile page, the enquiry flow and the migration are all
 * still here — switch this redirect off once there are vendors to show.
 */
export default function VendorsPage() {
  redirect("/");
}
