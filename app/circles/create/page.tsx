import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateCircleForm from "@/components/circles/CreateCircleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a circle" };

export default async function CreateCirclePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/circles/create");

  const { data: me } = await supabase
    .from("users")
    .select("state")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <AppHeader
        title="Create a circle"
        subtitle="A community around what you love — meetups, chats and shared events"
        back
      />
      <div className="container-page max-w-xl py-5">
        <div className="surface p-6 sm:p-8">
          <CreateCircleForm userState={me?.state ?? null} />
        </div>
      </div>
    </div>
  );
}
