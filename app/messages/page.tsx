import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import UserMessages from "@/components/UserMessages";
import InboxTabs from "@/components/InboxTabs";
import { createClient } from "@/lib/supabase/server";

/**
 * Messages, with an address of their own.
 *
 * They used to live at the bottom of /dashboard, below the link-up tabs and
 * above Your groups. To read a DM you opened the dashboard and scrolled past
 * everything you were not looking for, on a platform whose entire premise is
 * people talking to each other.
 *
 * A conversation is a destination, not a section of another page. It gets a
 * URL you can link to, a header, and an entry in the top bar on every screen.
 */

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Messages",
  description: "Your conversations on LinkUpNaija.",
};

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/messages");

  // The other half of the inbox, for the switcher's badge.
  const { count: unreadAlerts } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return (
    <div>
      <AppHeader title="Messages" subtitle="Hosts, guests and your paddies" back />
      <InboxTabs alerts={unreadAlerts ?? 0} messages={0} />

      <div className="container-page max-w-[720px] py-4">
        <UserMessages meId={user.id} />
      </div>
    </div>
  );
}
