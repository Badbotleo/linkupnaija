import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import TicketButton from "@/components/TicketButton";
import EventCover from "@/components/EventCover";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { formatNaira } from "@/lib/paystack";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets" };

/**
 * Tickets, on their own page.
 *
 * They lived inside a dashboard tab, so getting into an event meant opening
 * the dashboard, finding the right tab, finding the right row, and then
 * finding the ticket — at a door, in a queue, on mobile data. A ticket is
 * the one thing you need in a hurry.
 *
 * Both sides are here because both sides need something at the door: the
 * guest needs their QR, the host needs to scan them.
 */
export default async function TicketsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/tickets");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: me }, { data: mine }, { data: hosting }] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).single(),
    supabase
      .from("rsvps")
      .select(
        "id, attended, tier_id, events(id, title, date, time, location, state, price, category, cover_image_url)"
      )
      .eq("user_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("events")
      .select("id, title, date, time, location, category, cover_image_url")
      .eq("host_id", user.id)
      .gte("date", today)
      .order("date", { ascending: true }),
  ]);

  interface Ev {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    price?: number;
    category: string;
    cover_image_url: string | null;
  }
  type Row = { id: string; attended: boolean; tier_id: string | null; events: Ev | null };

  const rows = ((mine ?? []) as unknown as Row[]).filter((r) => r.events);

  // Tier names, in their own query — a missing ticket_tiers table shouldn't
  // take the page down, it should just mean no tier label.
  const tierIds = rows.map((r) => r.tier_id).filter(Boolean) as string[];
  const { data: tierRows } = tierIds.length
    ? await supabase.from("ticket_tiers").select("id, name, admits").in("id", tierIds)
    : { data: [] };
  const tiers = new Map(
    ((tierRows ?? []) as { id: string; name: string; admits: number | null }[]).map(
      (t) => [t.id, t]
    )
  );

  // Upcoming first, because a ticket to Saturday matters and one from March
  // is a souvenir.
  const upcoming = rows
    .filter((r) => r.events!.date >= today)
    .sort((a, b) => a.events!.date.localeCompare(b.events!.date));
  const past = rows
    .filter((r) => r.events!.date < today)
    .sort((a, b) => b.events!.date.localeCompare(a.events!.date));
  const hosted = (hosting ?? []) as unknown as Ev[];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000]">
      <AppHeader title="Tickets" subtitle="Everything you need at the door" />
      <div className="container-page py-5">
        {upcoming.length === 0 && hosted.length === 0 && past.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-16 text-center">
            <LineIcon name="ticket" size={26} className="mx-auto text-gray-300" />
            <p className="mt-3 font-semibold text-gray-700">No tickets yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Join a link-up and your ticket shows up here.
            </p>
            <Link href="/events" className="btn-primary mt-5 inline-flex rounded-full px-5 py-2.5">
              Find something on
            </Link>
          </div>
        ) : null}

        {upcoming.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900">Coming up</h2>
            <div className="mt-3 space-y-3">
              {upcoming.map((r) => {
                const e = r.events!;
                const tier = r.tier_id ? tiers.get(r.tier_id) : null;
                return (
                  <div key={r.id} className="relative">
                    {/* An actual ticket stub: cover art as the top band, a
                        torn perforation with notches punched out of the
                        sides, and the QR on the stub below it. A ticket that
                        looks like a receipt is a ticket nobody wants to
                        screenshot. */}
                    <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-gray-900/10 ring-1 ring-gray-900/5">
                      {/* --- top: the art --- */}
                      <Link href={`/events/${e.id}`} className="relative block">
                        <EventCover
                          url={e.cover_image_url}
                          category={e.category}
                          title={e.title}
                          className="h-40 w-full"
                          fit="cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                        {tier && (
                          <span className="absolute right-3 top-3 rounded-full bg-[#FFFFFF]/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#121212]">
                            {tier.name}
                          </span>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                          <p className="line-clamp-2 text-[19px] font-extrabold leading-tight">
                            {e.title}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-white/85">
                            <span className="font-bold">
                              {formatEventDate(e.date)}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{formatEventTime(e.time)}</span>
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-white/60">
                            {e.location}
                          </p>
                        </div>
                      </Link>

                      {/* --- the tear --- */}
                      <div className="relative">
                        {/* Notches, punched from the page background so the
                            card reads as torn rather than merely divided. */}
                        <span
                          aria-hidden
                          className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-gray-50 dark:bg-[#000000]"
                        />
                        <span
                          aria-hidden
                          className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-gray-50 dark:bg-[#000000]"
                        />
                        <div className="mx-5 border-t-2 border-dashed border-gray-200" />
                      </div>

                      {/* --- stub: the bit you actually show --- */}
                      <div className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                            Admits
                          </p>
                          <p className="text-[15px] font-extrabold text-gray-900">
                            {tier?.admits
                              ? `${tier.admits} people`
                              : me?.name ?? "You"}
                          </p>
                          {r.attended && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-naija-50 px-2 py-0.5 text-[10px] font-bold text-naija-700">
                              <LineIcon name="check" size={9} />
                              Checked in
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">
                          <TicketButton
                            rsvpId={r.id}
                            eventTitle={e.title}
                            attendeeName={me?.name ?? null}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hosted.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">You&apos;re hosting</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Open an event to scan tickets on the door.
            </p>
            <div className="mt-3 space-y-2">
              {hosted.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
                >
                  <EventCover
                    url={e.cover_image_url}
                    category={e.category}
                    title={e.title}
                    className="h-14 w-14 shrink-0 rounded-xl"
                    fit="cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">{e.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {formatEventDate(e.date)} · {formatEventTime(e.time)}
                    </p>
                  </div>
                  <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-900">Been and gone</h2>
            <div className="mt-3 space-y-2">
              {past.slice(0, 20).map((r) => {
                const e = r.events!;
                return (
                  <Link
                    key={r.id}
                    href={`/events/${e.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 opacity-80 transition hover:opacity-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-700">{e.title}</p>
                      <p className="text-xs text-gray-400">
                        {formatEventDate(e.date)}
                        {r.attended ? " · you were there" : ""}
                        {e.price ? ` · ${formatNaira(e.price)}` : ""}
                      </p>
                    </div>
                    <LineIcon name="chevronRight" size={15} className="shrink-0 text-gray-300" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
