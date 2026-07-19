import PageHero, { Gold } from "@/components/PageHero";
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
      <PageHero
        watermark="Circles"
        title={<>Find your <Gold>Circle</Gold></>}
        subtitle="Communities for the things you love. Find your people."
      >
        <Link href="/circles/create" className="btn bg-[#FAC775] font-bold text-[#1A1040] hover:bg-[#fbd28e] mt-5">
          + Create a circle
        </Link>
      </PageHero>
      <div className="container-page py-8">

      <CirclesExplorer meId={user?.id ?? null} myState={myState} />
      </div>
    </div>
  );
}
