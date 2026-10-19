import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payout history" };

/**
 * Every payout this host has ever asked for, and what became of it.
 *
 * WHY THIS EXISTS. The dashboard could tell a host what was owed and let
 * them request it, and then the record vanished: the payout card on the
 * event swapped its button for a status pill, and that pill was the only
 * trace. Request a payout for a link-up from March and the only way to find
 * out what happened to it was to scroll the dashboard until that event's card
 * came past, assuming it still did. "Paid out N1,350" on the earnings card
 * was a total with nothing behind it.
 *
 * So this is the ledger. One row per request, oldest question first: what
 * was it for, how much, where has it got to, and when.
 *
 * THE DATES ARE TWO DIFFERENT FACTS. created_at is when the host asked.
 * paid_at is when the money actually went, and it did not exist until now —
 * the table held a status string and nothing recording when it changed, so
 * even support could not answer "when was I paid" from the database. A
 * trigger stamps it on the way to paid; rows that were already paid before
 * the trigger existed are backfilled to their request date and are therefore
 * at worst early, which beats a column of blanks.
 */

const STATUS_COPY: Record<
  string,
  { label: string; note: string; tone: string; icon: string }
> = {
  pending: {
    label: "Pending",
    note: "We are checking the sales against Paystack.",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    icon: "clock",
  },
  approved: {
    label: "Approved",
    note: "Cleared. The transfer is on its way to your bank.",
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    icon: "check",
  },
  paid: {
    label: "Paid",
    note: "Sent to your bank.",
    tone: "bg-naija-100 text-naija-700 dark:bg-naija-500/15 dark:text-naija-300",
    icon: "check",
  },
  declined: {
    label: "Declined",
    note: "Email support@linkupnaija.com and we will explain why.",
    tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    icon: "x",
  },
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PayoutHistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/payouts");

  const { data: rows } = await supabase
    .from("payouts")
    .select("id, event_id, amount, platform_fee, status, created_at, paid_at")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  const payouts = (rows ?? []) as {
    id: string;
    event_id: string | null;
    amount: number | null;
    platform_fee: number | null;
    status: string;
    created_at: string;
    paid_at: string | null;
  }[];

  // The event titles, in one query rather than one per row. A payout whose
  // event has since been deleted still has to render: the money was real.
  const eventIds = Array.from(
    new Set(payouts.map((p) => p.event_id).filter((id): id is string => !!id))
  );
  let titles = new Map<string, { title: string; date: string }>();
  if (eventIds.length) {
    const { data: evs } = await supabase
      .from("events")
      .select("id, title, date")
      .in("id", eventIds);
    titles = new Map(
      ((evs ?? []) as { id: string; title: string; date: string }[]).map((e) => [
        e.id,
        { title: e.title, date: e.date },
      ])
    );
  }

  const paid = payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const inFlight = payouts
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div>
      <AppHeader
        title="Payout history"
        subtitle="Every request and where it got to"
        back
      />

      <div className="container-page max-w-[640px] space-y-4 py-4">
        {payouts.length === 0 ? (
          /* Not an error, and not an apology. A host with no payouts yet is
             the normal case, and the useful thing to hand them is the way
             to have one. */
          <div className="surface p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand dark:bg-white/[0.06]">
              <LineIcon name="ticket" size={22} />
            </span>
            <p className="mt-3 font-bold text-gray-900 dark:text-white">
              No payouts yet
            </p>
            <p className="mx-auto mt-1 max-w-[34ch] text-[14px] leading-snug text-gray-500">
              When a paid link-up of yours has happened, request the money from
              your dashboard and it will show up here.
            </p>
            <Link
              href="/dashboard#payouts"
              className="btn-primary mt-4 inline-flex px-5 py-2.5"
            >
              Back to your dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* The two totals worth having at the top: what has landed, and
                what is still in the system. */}
            <div className="grid grid-cols-2 gap-3">
              <Total label="Paid to you" value={paid} bright />
              <Total label="Being processed" value={inFlight} />
            </div>

            <ul className="space-y-3">
              {payouts.map((p) => {
                const ev = p.event_id ? titles.get(p.event_id) : undefined;
                const s = STATUS_COPY[p.status] ?? {
                  label: p.status,
                  note: "Email support@linkupnaija.com for an update.",
                  tone: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/70",
                  icon: "clock",
                };
                return (
                  <li key={p.id} className="surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* The event is a link while it exists and plain text
                            when it does not, rather than a link to a 404. */}
                        {ev && p.event_id ? (
                          <Link
                            href={`/events/${p.event_id}`}
                            className="block truncate font-bold text-gray-900 hover:text-brand dark:text-white"
                          >
                            {ev.title}
                          </Link>
                        ) : (
                          <p className="truncate font-bold text-gray-900 dark:text-white">
                            {ev?.title ?? "A link-up that has since been removed"}
                          </p>
                        )}
                        <p className="mt-0.5 text-[12.5px] text-gray-400">
                          Requested {longDate(p.created_at)}
                          {p.paid_at ? ` · Paid ${longDate(p.paid_at)}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[17px] font-extrabold tabular-nums text-gray-900 dark:text-white">
                        {formatNaira(p.amount ?? 0)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${s.tone}`}
                      >
                        <LineIcon name={s.icon} size={12} />
                        {s.label}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[12.5px] text-gray-500">
                        {s.note}
                      </p>
                    </div>

                    {/* Where the money came from, for the row that raises the
                        question. Same link the payout card carries, kept here
                        so the ledger is not a dead end. */}
                    {p.event_id && (
                      <Link
                        href={`/events/${p.event_id}/buyers`}
                        className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-100 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/10"
                      >
                        See who paid
                        <LineIcon
                          name="chevronRight"
                          size={14}
                          className="ml-auto text-gray-400"
                        />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="px-1 text-center text-[12.5px] leading-snug text-gray-400">
              Something here look wrong? Email support@linkupnaija.com with the
              link-up name and we will trace it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Total({
  label,
  value,
  bright = false,
}: {
  label: string;
  value: number;
  bright?: boolean;
}) {
  return (
    <div className="surface px-4 py-3.5">
      <p
        className={`text-[20px] font-extrabold tabular-nums ${
          bright ? "text-naija-600" : "text-gray-900 dark:text-white"
        }`}
      >
        {formatNaira(value)}
      </p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
        {label}
      </p>
    </div>
  );
}
