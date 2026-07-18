import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();

  // Public, token-scoped opt-out via a SECURITY DEFINER RPC (no login needed).
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.token
    );
  const { data, error } = uuid
    ? await supabase.rpc("unsubscribe_by_token", { p_token: params.token })
    : { data: false, error: null };

  const ok = !error && data === true;

  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-5xl">{ok ? "👋" : "🤔"}</p>
      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
        {ok ? "You're unsubscribed" : "Link not recognised"}
      </h1>
      <p className="mt-2 max-w-md text-gray-600">
        {ok
          ? "You won't receive the weekly digest anymore. You can re-enable it anytime from your email preferences."
          : "We couldn't process that unsubscribe link. It may have expired. You can manage all your email preferences from your profile instead."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/profile/edit" className="btn-primary">
          Email preferences
        </Link>
        <Link href="/events" className="btn-outline">
          Browse events
        </Link>
      </div>
    </div>
  );
}
