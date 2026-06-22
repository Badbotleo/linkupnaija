import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/events");

  return (
    <div className="container-page flex max-w-md flex-col py-14">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Welcome back 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Log in to join events and host your own.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
