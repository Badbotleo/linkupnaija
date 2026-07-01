import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CirclesExplorer from "@/components/circles/CirclesExplorer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Circles",
  description:
    "Join LinkUpNaija Circles — community groups for foodies, book lovers, hikers, gamers and more across Nigeria.",
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
    <div className="container-page py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Circles</h1>
          <p className="mt-1 text-gray-600">
            Communities for the things you love — find your people.
          </p>
        </div>
        <Link href="/circles/create" className="btn-primary self-start sm:self-auto">
          + Create a circle
        </Link>
      </div>

      <CirclesExplorer meId={user?.id ?? null} myState={myState} />
    </div>
  );
}
