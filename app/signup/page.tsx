import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign up",
  description:
    "Create a free LinkUpNaija account and never miss a vibe. Join events across Nigeria or host your own.",
};

export default async function SignupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/events");

  return (
    <div className="container-page flex max-w-md flex-col py-14">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Join LinkUp<span className="text-brand">Naija</span> 🎉
        </h1>
        <p className="mt-2 text-gray-600">
          Create a free account and never miss a vibe.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}
