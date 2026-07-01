import Link from "next/link";
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
    <div className="container-page max-w-xl py-10">
      <Link href="/circles" className="text-sm font-medium text-gray-500 hover:text-brand">
        ← Back to circles
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold text-gray-900">Create a circle</h1>
      <p className="mt-1 text-gray-600">
        Start a community around what you love — meetups, chats and shared events.
      </p>
      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <CreateCircleForm userState={me?.state ?? null} />
      </div>
    </div>
  );
}
