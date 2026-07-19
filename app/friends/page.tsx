import PageHero, { Gold } from "@/components/PageHero";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendsManager from "@/components/friends/FriendsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/friends");

  const { data: me } = await supabase
    .from("users")
    .select("state")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <PageHero
        title={<>Your <Gold>people</Gold></>}
        subtitle="Find friends, accept requests, and build your circle on LinkUpNaija."
      />
      <div className="container-page max-w-2xl py-8">

      <div className="mt-8">
        <FriendsManager meId={user.id} myState={me?.state ?? null} />
      </div>
      </div>
    </div>
  );
}
