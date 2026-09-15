import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in",
  description: "Log in to join events and host your own on LinkUpNaija.",
};

/**
 * Where to send somebody who is already signed in.
 *
 * This used to be a flat redirect("/events"), which quietly threw away the
 * ?redirect the visitor arrived with. The giveaway link is the case that
 * showed it: somebody opens /claim/potluck in an in-app browser, taps "Log in
 * to claim", and if the session is already good by the time /login renders
 * they land on the events feed instead of the thing they were promised, with
 * nothing on screen explaining why.
 *
 * Only same-site paths are honoured. A redirect parameter is attacker
 * controlled, and "//evil.example" is a protocol-relative URL that a bare
 * startsWith("/") check would wave straight through.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/events";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/events";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(safeNext(searchParams.redirect));

  // Matches /signup exactly: one centred card, no split brand panel. Two
  // auth screens built on different layouts is the kind of seam people feel
  // without being able to name — and the member/event counts the old panel
  // showed were the only reason this page hit the database at all.
  return (
    <div className="container-page flex max-w-md flex-col py-14">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Welcome back to LinkUp<span className="text-brand">Naija</span> 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Log in to join events and host your own.
        </p>
      </div>

      <div className="mt-8 surface p-6 sm:p-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
