import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HostForm from "@/components/HostForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Host an event",
  description:
    "Create a link-up on LinkUpNaija — set the vibe, pick a spot, add a cover photo and gather your people.",
};

export default async function HostPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware also guards this, but double-check on the server.
  if (!user) redirect("/login?redirect=/host");

  const { data: profile } = await supabase
    .from("users")
    .select("state")
    .eq("id", user.id)
    .single();

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Host a link-up 🎤
        </h1>
        <p className="mt-2 text-gray-600">
          Set the vibe, pick a spot, and gather your people.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <HostForm hostState={profile?.state ?? null} />
      </div>
    </div>
  );
}
