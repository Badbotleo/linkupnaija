import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";

export const dynamic = "force-dynamic";

/**
 * Where people drop off between seeing an event and turning up.
 *
 * A host could already see that twelve people said yes. What they couldn't
 * see was that nine hundred looked first — which is the number that tells you
 * whether the problem is the flyer, the price, or the date.
 *
 * Four stages, each a share of the one above it. Deliberately not a chart
 * library: four bars is four divs, and the drop between them is the whole
 * story.
 */

interface Funnel {
  viewed: number;
  interested: number;
  rsvpd: number;
  attended: number;
}

const STAGES: {
  key: keyof Funnel;
  label: string;
  hint: string;
  tint: string;
}[] = [
  { key: "viewed", label: "Viewed your event", hint: "Opened the page", tint: "bg-gray-300" },
  { key: "interested", label: 'Tapped "interested"', hint: "Saved it for later", tint: "bg-brand/40" },
  { key: "rsvpd", label: 'RSVP’d "going"', hint: "You approved them", tint: "bg-brand" },
  { key: "attended", label: "Actually attended", hint: "Scanned at the door", tint: "bg-[#FF6B5E]" },
];

export default async function EventAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/events/${params.id}/analytics`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, host_id, date")
    .eq("id", params.id)
    .single();
  if (!event) notFound();
  if (event.host_id !== user.id) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <p className="text-lg font-bold text-gray-900">Not your event</p>
        <p className="mt-1 text-sm text-gray-500">
          Only the host can see an event&apos;s numbers.
        </p>
        <Link href={`/events/${params.id}`} className="btn-outline mt-4 inline-flex">
          Back to the event
        </Link>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("event_funnel", {
    p_event: params.id,
  });
  const row = (Array.isArray(data) ? data[0] : data) as Funnel | undefined;

  // The migration hasn't run — say so, rather than rendering four zeros that
  // read as "nobody came".
  if (error || !row) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <p className="text-lg font-bold text-gray-900">Analytics aren&apos;t on yet</p>
        <p className="mt-1 text-sm text-gray-500">
          The database migration for event analytics hasn&apos;t been run.
        </p>
        <Link href={`/events/${params.id}`} className="btn-outline mt-4 inline-flex">
          Back to the event
        </Link>
      </div>
    );
  }

  const top = Math.max(row.viewed, 1);
  const pct = (n: number) => Math.max(n > 0 ? 3 : 0, Math.round((n / top) * 100));

  // The one line a host actually acts on.
  const insight = (() => {
    if (row.viewed === 0) return "No views yet. Share the link and check back.";
    if (row.rsvpd === 0)
      return `${row.viewed} people looked and nobody asked to join yet — worth a second look at the price or the date.`;
    const lookToJoin = Math.round((row.rsvpd / row.viewed) * 100);
    if (row.attended > 0) {
      const showUp = Math.round((row.attended / row.rsvpd) * 100);
      return `${lookToJoin}% of viewers asked to join, and ${showUp}% of those turned up.`;
    }
    return `${lookToJoin}% of the people who looked asked to join.`;
  })();

  return (
    <div className="pb-10">
      <AppHeader title="Event analytics" back />
      <div className="container-page max-w-xl pt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">
          After you post
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900">
          See exactly where people drop off.
        </h1>
        <p className="mt-1 truncate text-sm text-gray-500">{event.title}</p>

        <div className="mt-6 space-y-4">
          {STAGES.map((s) => {
            const n = row[s.key];
            return (
              <div key={s.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold text-gray-900">
                    {s.label}
                  </p>
                  <p className="shrink-0 text-[20px] font-extrabold tabular-nums text-gray-900">
                    {n.toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${s.tint} transition-[width] duration-700`}
                    style={{ width: `${pct(n)}%` }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-gray-400">{s.hint}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/[0.04] p-4">
          <p className="flex items-start gap-2 text-[14px] leading-snug text-gray-800">
            <span className="mt-0.5 shrink-0 text-brand">
              <LineIcon name="trending" size={15} />
            </span>
            {insight}
          </p>
        </div>

        <p className="mt-4 text-[12px] leading-snug text-gray-400">
          Views count one person per day, and your own visits aren&apos;t
          counted. Nobody&apos;s identity is stored — these are numbers, not a
          list of who looked.
        </p>

        <Link
          href={`/events/${params.id}`}
          className="btn-outline mt-6 inline-flex w-full justify-center"
        >
          Back to the event
        </Link>
      </div>
    </div>
  );
}
