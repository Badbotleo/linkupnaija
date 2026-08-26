import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You're invited",
  description:
    "Your friend invited you to LinkUpNaija. Sign up and get ₦600 wallet credit for your first event.",
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
  const code = searchParams.ref?.toUpperCase();

  // Somebody already signed in cannot be referred, so there is nothing on this
  // page for them. Where to send them depends on how they got here.
  //
  // Following a friend's invite link, the feed is right: they are already in.
  // But arriving with no code means they scanned a campus poster that promised
  // ₦600 for bringing a paddy, and bouncing them to the events feed answers a
  // question they did not ask. /refer is the thing the poster advertised.
  if (user) redirect(code ? "/events" : "/refer");
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
        {/* Without a code there is no referrer, and complete_referral pays
            nothing — so the invited copy would be promising ₦600 that never
            arrives. It only ever reached people who followed a real invite
            link, but the campus posters point here, which makes the bare page
            the common case rather than the edge one. */}
        <h1 className="mt-2 text-2xl font-extrabold">
          {firstName
            ? `${firstName} invited you to LinkUpNaija`
            : code
              ? "You're invited to LinkUpNaija"
              : "Join LinkUpNaija"}
        </h1>
        {code ? (
          <p className="mt-2 text-brand-100">
            Sign up now and get{" "}
            <span className="font-bold text-white">₦600 wallet credit</span> to
            spend on your first event.
          </p>
        ) : (
          <p className="mt-2 text-brand-100">
            Free to join. Bring a paddy and you{" "}
            <span className="font-bold text-white">both get ₦600</span> wallet
            credit.
          </p>
        )}
      </div>

      <div className="mt-6 surface p-6 sm:p-8">
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        {code ? (
          "Your ₦600 bonus is added once you verify your email."
        ) : (
          <>
            {/* The withdrawal floor is a real condition but it is not a
                doorstep conversation. Leading with "you need five friends
                before you see a naira" talks somebody out of an account they
                have not opened yet, so the number lives in the terms and the
                offer stays the offer. */}
            Once you&apos;re in, share your invite link and you both get ₦600.{" "}
            <Link href="/terms-of-service" className="underline hover:text-gray-600">
              Wallet terms apply
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
