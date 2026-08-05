import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in",
  description: "Log in to join events and host your own on LinkUpNaija.",
};

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/events");

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
