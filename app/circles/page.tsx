import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CirclesExplorer from "@/components/circles/CirclesExplorer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Circles",
  description:
    "Join LinkUpNaija Circles: community groups for foodies, book lovers, hikers, gamers and more across Nigeria.",
};

export default async function CirclesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myState: string | null = null;
  if (user) {
    const { data } = await supabase.from("users").select("state").eq("id", user.id).single();
    myState = data?.state ?? null;
  }

  return (
    <div>
      <AppHeader
        title={"Circles"}
        subtitle={<>Communities for the things you love</>}
        action={<Link href="/circles/create" className="btn-primary rounded-full px-4 py-2 text-sm">Create</Link>}
      />
      <div className="container-page py-5">

      <CirclesExplorer meId={user?.id ?? null} myState={myState} />
      </div>
    </div>
  );
}
