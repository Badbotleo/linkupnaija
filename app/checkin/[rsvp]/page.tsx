import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckInClient from "./CheckInClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in" };

// Opened when a host scans an attendee's QR ticket. Must be logged in as the
// host; the RPC enforces that only the event host can actually check people in.
export default async function CheckInPage({
  params,
}: {
  params: { rsvp: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/checkin/${params.rsvp}`);

  return <CheckInClient rsvpId={params.rsvp} />;
}
