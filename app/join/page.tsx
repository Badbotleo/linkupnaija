import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You're invited",
  description:
    "Your friend invited you to LinkUpNaija. Sign up and get ₦500 wallet credit for your first event.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/events");

  const code = searchParams.ref?.toUpperCase();
  let referrerName: string | null = null;
  if (code) {
    const { data } = await supabase
      .from("users")
      .select("name")
      .eq("referral_code", code)
      .single();
    referrerName = data?.name ?? null;
  }
  const firstName = referrerName?.split(" ")[0] ?? null;

  return (
    <div className="container-page flex max-w-md flex-col py-14">
      <div className="rounded-2xl bg-brand p-6 text-center text-white shadow-card">
        <p className="text-3xl">🎉</p>
        <h1 className="mt-2 text-2xl font-extrabold">
          {firstName ? `${firstName} invited you to LinkUpNaija` : "You're invited to LinkUpNaija"}
        </h1>
        <p className="mt-2 text-brand-100">
          Sign up now and get{" "}
          <span className="font-bold text-white">₦500 wallet credit</span> to
          spend on your first event.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Your ₦500 bonus is added once you verify your email.
      </p>
    </div>
  );
}
