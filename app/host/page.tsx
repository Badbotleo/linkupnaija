import PageHero, { Gold } from "@/components/PageHero";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HostForm from "@/components/HostForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Host an event",
  description:
    "Create a link-up on LinkUpNaija: set the vibe, pick a spot, add a cover photo and gather your people.",
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
    .select("state, moderation_status")
    .eq("id", user.id)
    .single<{ state: string | null; moderation_status?: string }>();

  // Restricted/blocked accounts can't host (also enforced by a DB trigger).
  const status = profile?.moderation_status;
  if (status === "restricted" || status === "blocked") {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <p className="text-5xl">🚫</p>
        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
          Hosting unavailable
        </h1>
        <p className="mt-2 text-gray-600">
          Your account is currently {status} and can&apos;t create events. If
          you think this is a mistake, contact{" "}
          <a href="mailto:support@linkupnaija.com" className="font-semibold text-brand">
            support@linkupnaija.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        title={<>Host a <Gold>link-up</Gold></>}
        subtitle="Set the vibe, pick a spot, and gather your people."
      />
      <div className="container-page max-w-2xl py-8">

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <HostForm hostState={profile?.state ?? null} />
      </div>
      </div>
    </div>
  );
}
