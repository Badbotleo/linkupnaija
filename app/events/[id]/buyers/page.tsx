import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import Avatar from "@/components/Avatar";
import LineIcon from "@/components/ui/LineIcon";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

/**
 * Who paid, one row each.
 *
 * A host could see that ₦45,000 had come in and nothing about where it came
 * from. Admin has had a per-buyer view since the beginning; the person whose
 * money it is has not. That is the wrong way round, and it is the most
 * obvious "can I trust this platform with my money" objection a host has.
 *
 * Deliberately no email addresses. A host who needs to reach a buyer taps
 * their name and messages them, which keeps the conversation on the platform
 * and does not hand somebody's inbox to whoever ran a party once. The
 * transactions table is already readable by the host of the event, so this
 * adds a screen rather than a permission.
 */

export const metadata = { title: "Who paid" };

interface Row {
  id: string;
  amount: number;
  platform_fee: number;
  fee_on_top: boolean | null;
  paystack_reference: string | null;
  created_at: string;
  buyer: { id: string; name: string | null; avatar_url: string | null } | null;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function EventBuyersPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${params.id}/buyers`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, host_id, price")
    .eq("id", params.id)
    .single();
  if (!event) notFound();

  if (event.host_id !== user.id) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          Not your link-up
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Only the host can see who paid.
        </p>
        <Link
          href={`/events/${params.id}`}
          className="btn-outline mt-4 inline-flex"
        >
          Back to the link-up
        </Link>
      </div>
    );
  }

  // fee_on_top arrived with the buyer-pays-fee change. A select naming a
  // column that is not there yet fails the whole query, so it falls back
  // rather than showing the host an error where their money should be.
  const SELECT =
    "id, amount, platform_fee, fee_on_top, paystack_reference, created_at, " +
    "buyer:users!transactions_user_id_fkey(id, name, avatar_url)";
  let { data, error } = await supabase
    .from("transactions")
    .select(SELECT)
    .eq("event_id", params.id)
    .order("created_at", { ascending: false });
  if (error?.code === "42703") {
    ({ data } = await supabase
      .from("transactions")
      .select(
        "id, amount, platform_fee, paystack_reference, created_at, " +
          "buyer:users!transactions_user_id_fkey(id, name, avatar_url)"
      )
      .eq("event_id", params.id)
      .order("created_at", { ascending: false }));
  }
  const rows = (data ?? []) as unknown as Row[];

  // Paid RSVPs with no transaction behind them. The money left the guest's
  // account and is invisible in every total on this page, so it is named.
  const { data: paidRsvps } = await supabase
    .from("rsvps")
    .select("id")
    .eq("event_id", params.id)
    .not("payment_reference", "is", null);
  const unrecorded = Math.max(0, (paidRsvps?.length ?? 0) - rows.length);

  const collected = rows.reduce((s, r) => s + r.amount, 0);
  const fees = rows.reduce((s, r) => s + r.platform_fee, 0);
  // The same branch the payout card uses. Legacy rows had our cut taken out
  // of the ticket price; new ones add it on top of it.
  const due = rows.reduce(
    (s, r) => s + (r.fee_on_top ? r.amount : r.amount - r.platform_fee),
    0
  );

  return (
    <div>
      <AppHeader title="Who paid" subtitle={event.title} back />

      <div className="container-page max-w-[720px] py-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-4 text-center shadow-[var(--e1)] dark:bg-white/[0.04]">
          <div>
            <p className="text-xs text-gray-400">Tickets</p>
            <p className="mt-0.5 text-[19px] font-extrabold text-gray-900 dark:text-white">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Collected</p>
            <p className="mt-0.5 text-[19px] font-extrabold text-gray-900 dark:text-white">
              {formatNaira(collected)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">You get</p>
            <p className="mt-0.5 text-[19px] font-extrabold text-brand">
              {formatNaira(due)}
            </p>
          </div>
        </div>

        {fees > 0 && (
          <p className="mt-2 px-1 text-[13px] text-gray-500">
            {formatNaira(fees)} of booking fees is not yours and is not
            included above.
          </p>
        )}

        {unrecorded > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <strong>{unrecorded}</strong> guest{unrecorded === 1 ? "" : "s"} paid
            but the payment did not record, so they are missing from this list
            and from the totals. Email support@linkupnaija.com and we will
            reconcile it against Paystack.
          </p>
        )}

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center dark:border-white/15 dark:bg-white/[0.03]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow-sm dark:bg-white/10">
              <LineIcon name="ticket" size={22} />
            </span>
            <p className="mt-3 font-bold text-gray-900 dark:text-white">
              No tickets sold yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
              Every sale shows up here the moment it goes through, with who
              bought it and when.
            </p>
            <Link href={`/events/${params.id}`} className="btn-primary mt-5">
              See your link-up
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
            {rows.map((r) => {
              // What left their account, which is the number they recognise
              // from their bank alert.
              const paid = r.fee_on_top ? r.amount + r.platform_fee : r.amount;
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  {/* The name is a link, so a host who needs to reach
                      somebody can message them rather than being handed an
                      email address. */}
                  <Link
                    href={`/u/${r.buyer?.id ?? ""}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar
                      name={r.buyer?.name ?? null}
                      url={r.buyer?.avatar_url ?? null}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-gray-900 hover:text-brand dark:text-white">
                        {r.buyer?.name ?? "A member"}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {when(r.created_at)}
                        {r.paystack_reference &&
                          r.paystack_reference !== "wallet" && (
                            <> · {r.paystack_reference}</>
                          )}
                        {r.paystack_reference === "wallet" && <> · wallet</>}
                      </span>
                    </span>
                  </Link>
                  <span className="shrink-0 text-right">
                    <span className="block font-extrabold text-gray-900 dark:text-white">
                      {formatNaira(paid)}
                    </span>
                    {r.fee_on_top && r.platform_fee > 0 && (
                      <span className="block text-[11px] text-gray-400">
                        incl. {formatNaira(r.platform_fee)} fee
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard#payouts" className="btn-primary py-2 text-sm">
            Request a payout
          </Link>
          <Link
            href={`/events/${params.id}`}
            className="btn-outline py-2 text-sm"
          >
            Back to the link-up
          </Link>
        </div>
      </div>
    </div>
  );
}
