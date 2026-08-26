import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FREE_HOST_LIMIT, isProActive, monthStartISO } from "@/lib/pro";
import HostForm from "@/components/HostForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Host an event",
  description:
    "Create a link-up on LinkUpNaija: set the vibe, pick a spot, add a cover photo and gather your people.",
};

export default async function HostPage({
  searchParams,
}: {
  searchParams: {
    category?: string;
    location?: string;
    state?: string;
    title?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware also guards this, but double-check on the server.
  if (!user) redirect("/login?redirect=/host");

  const { data: profile } = await supabase
    .from("users")
    .select("state, moderation_status, is_pro, pro_expires_at")
    .eq("id", user.id)
    .single<{
      state: string | null;
      moderation_status?: string;
      is_pro?: boolean | null;
      pro_expires_at?: string | null;
    }>();

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

  // Hosting needs a verified number, asked of the same function the RLS
  // policy uses so this page and the database can never disagree about who
  // may host.
  //
  // Fails OPEN. Before migration-host-phone-gate.sql runs the function does
  // not exist and the call errors, which must not look like a locked door to
  // every host on the platform. The policy fails closed, and that is the half
  // that actually enforces anything — events are inserted from the browser,
  // so this check is here to explain the rule, not to be the rule.
  const { data: mayHost, error: mayHostErr } = await supabase.rpc("may_host");
  if (!mayHostErr && mayHost === false) {
    return (
      <div>
        <AppHeader title="Host a link-up" back />
        <div className="container-page max-w-lg py-10 text-center">
          <div className="surface p-7">
            <p className="text-4xl">📱</p>
            <h1 className="mt-3 text-2xl font-extrabold text-gray-900">
              Verify your number to host
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
              Hosts collect money and put people in a room together, so we ask
              for a working number first. It takes a minute and nobody sees it
              but us.
            </p>
            <Link
              href="/profile/edit"
              className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              Verify my number
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Nothing changes for joining.{" "}
            <Link href="/events" className="font-semibold text-brand">
              Find a link-up
            </Link>{" "}
            while you&apos;re here.
          </p>
        </div>
      </div>
    );
  }

  // Free members host a set number of events a month; Pro is unlimited.
  // Counted on created_at, so deleting an event doesn't buy back a slot —
  // otherwise the limit is trivially defeated by create-then-delete.
  const isPro = isProActive(profile?.is_pro, profile?.pro_expires_at);
  let hostedThisMonth = 0;
  if (!isPro) {
    const { count, error: countErr } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id)
      .gte("created_at", monthStartISO());
    // Never block someone because the count itself failed — a broken query
    // should not look like a paywall.
    if (!countErr) hostedThisMonth = count ?? 0;
  }

  if (!isPro && hostedThisMonth >= FREE_HOST_LIMIT) {
    return (
      <div>
        <AppHeader title="Host a link-up" back />
        <div className="container-page max-w-lg py-10 text-center">
          <div
            className="overflow-hidden rounded-3xl p-7 text-white shadow-card"
            style={{ background: "linear-gradient(135deg, #534AB7 0%, #121212 100%)" }}
          >
            <p className="text-4xl">🎪</p>
            <h1 className="mt-3 text-2xl font-extrabold">
              That&apos;s {FREE_HOST_LIMIT} events this month
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Free members host {FREE_HOST_LIMIT} link-ups a month. Go Pro for
              unlimited hosting — run a weekly night without ever hitting this
              wall again.
            </p>
            <Link
              href="/pro"
              className="mt-5 inline-flex rounded-full bg-[#FAC775] px-6 py-3 text-sm font-black text-[#121212] transition hover:brightness-105"
            >
              Go Pro for unlimited hosting
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Your free slots reset on the 1st. Meanwhile you can still{" "}
            <Link href="/events" className="font-semibold text-brand">
              join other link-ups
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader
        title={"Host a link-up"}
        subtitle={<>Set the vibe, pick a spot, gather your people</>}
        back
      />
      <div className="container-page max-w-2xl py-5">

      {!isPro && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-50 px-4 py-3">
          <p className="text-sm text-gray-700">
            <span className="font-bold text-gray-900">
              {FREE_HOST_LIMIT - hostedThisMonth} of {FREE_HOST_LIMIT}
            </span>{" "}
            free events left this month
          </p>
          <Link
            href="/pro"
            className="shrink-0 whitespace-nowrap text-sm font-bold text-brand hover:underline"
          >
            Go unlimited
          </Link>
        </div>
      )}

      <div className="surface p-6 sm:p-8">
        <HostForm
          hostState={profile?.state ?? null}
          prefill={{
            category: searchParams.category,
            location: searchParams.location,
            state: searchParams.state,
            title: searchParams.title,
          }}
        />
      </div>
      </div>
    </div>
  );
}
