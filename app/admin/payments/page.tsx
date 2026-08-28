import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ticket payments" };

/**
 * Everyone who paid for a ticket.
 *
 * Its own page rather than another block on the admin desk: this is the list
 * you open when somebody says they paid and cannot get in, and hunting for it
 * under four other sections is exactly the wrong moment to be scrolling.
 *
 * No migration. "Admins read all transactions" already exists on the table,
 * so the admin's own session can select this directly — but that also means
 * the page MUST check is_admin itself. Without the check a non-admin gets a
 * page that renders an empty table rather than a refusal, which reads as "no
 * payments" instead of "not for you".
 */
const SELECT =
  "id, amount, platform_fee, paystack_reference, created_at, " +
  "buyer:users!transactions_user_id_fkey(name, email), " +
  "event:events!transactions_event_id_fkey(id, title, date)";

interface Payment {
  id: string;
  amount: number;
  platform_fee: number;
  paystack_reference: string | null;
  created_at: string;
  buyer: { name: string | null; email: string | null } | null;
  event: { id: string; title: string; date: string } | null;
}

export default async function AdminPaymentsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/payments");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean | null }>();
  if (!me?.is_admin) redirect("/");

  const { data, error } = await supabase
    .from("transactions")
    .select(SELECT)
    .order("created_at", { ascending: false });

  const payments = (data ?? []) as unknown as Payment[];

  const gross = payments.reduce((n, p) => n + (p.amount || 0), 0);
  const fees = payments.reduce((n, p) => n + (p.platform_fee || 0), 0);
  // What the hosts are owed. The number that matters at payout time, and the
  // one nobody can work out in their head from the other two.
  const toHosts = gross - fees;
  const buyers = new Set(payments.map((p) => p.buyer?.email ?? p.id)).size;

  const naira = (n: number) => formatNaira(n);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div className="container-page max-w-5xl py-4">
      <AppHeader
        title="Ticket payments"
        back
        meta={[
          { icon: "ticket", label: `${payments.length} paid` },
          { icon: "users", label: `${buyers} buyers` },
        ]}
        action={
          <Link
            href="/admin"
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand"
          >
            Admin
          </Link>
        }
      />

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Couldn&apos;t load payments: {error.message}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Collected", value: naira(gross) },
          { label: "Platform fees", value: naira(fees) },
          { label: "Owed to hosts", value: naira(toHosts) },
          { label: "Payments", value: String(payments.length) },
        ].map((s) => (
          <div key={s.label} className="surface p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
              {s.label}
            </p>
            <p className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-gray-900">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="surface mt-5 overflow-hidden">
        {payments.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-gray-500">
            {error
              ? "The query failed, so this is not a real zero."
              : "Nobody has paid for a ticket yet. Free link-ups don't appear here."}
          </p>
        ) : (
          // Scrolls inside its own box: a reference on the right that pushes
          // the page sideways on a phone makes the whole table unusable.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-100 text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">
                <tr>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Link-up</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">
                        {p.buyer?.name ?? "Deleted account"}
                      </p>
                      <p className="text-[12px] text-gray-500">{p.buyer?.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.event ? (
                        <Link
                          href={`/events/${p.event.id}`}
                          className="font-semibold text-brand hover:underline"
                        >
                          {p.event.title}
                        </Link>
                      ) : (
                        // event_id is ON DELETE SET NULL, so a deleted event
                        // leaves the payment behind. It still happened and
                        // still has to be reconciled.
                        <span className="text-gray-500">Event deleted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                      {naira(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                      {naira(p.platform_fee)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {when(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="select-all font-mono text-[11px] text-gray-500">
                        {p.paystack_reference ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-gray-500">
        Times are Lagos. The reference is what to search in Paystack when a
        payment needs chasing, so it is selectable on tap.
      </p>
    </div>
  );
}
