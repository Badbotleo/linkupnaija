import { notFound } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate } from "@/lib/format";
import LineIcon from "@/components/ui/LineIcon";
import ClaimSlot from "@/components/claim/ClaimSlot";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Claim a ticket",
  // A giveaway link is handed to a group, not indexed. Somebody arriving from
  // a search result three weeks after the slots ran out learns nothing.
  robots: { index: false, follow: false },
};

/**
 * A giveaway slot, on its own page.
 *
 * This exists because a N0 tier on a paid event's page is a price cut rather
 * than a giveaway. Put it behind its own link and the N2,000 on the event page
 * stays the price, while ten people from somebody's group chat get in free.
 *
 * THREE RULES, and they govern different things.
 *
 *   First come, first served decides who gets into the QUEUE. When the slots
 *   are gone the page says so and stops taking claims.
 *
 *   The host decides who gets IN. A claim is a request, exactly like any other
 *   request, and it lands in the same approvals list.
 *
 *   A fuller profile is read SOONER, because a host works down a list and
 *   stops. It does not buy a yes.
 *
 * The page says all three out loud. A ranking nobody is told about changes no
 * behaviour, and the entire reason to rank on profile is that 23% of members
 * have a photo and a host approving strangers is currently looking at nothing.
 */
export default async function ClaimPage({
  params,
}: {
  params: { code: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: slotRows, error } = await supabase.rpc("claim_slots", {
    p_code: params.code,
  });
  const slot = (
    slotRows as
      | {
          tier_id: string;
          event_id: string;
          tier_name: string;
          quantity: number | null;
          taken: number;
          remaining: number | null;
          closes_at: string | null;
          is_open: boolean;
        }[]
      | null
  )?.[0];

  // A missing function and a wrong code look the same to a visitor, and both
  // mean there is nothing here to claim.
  if (error || !slot) notFound();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, date, time, location, state, price, cover_image_url")
    .eq("id", slot.event_id)
    .maybeSingle();
  if (!event) notFound();

  const ev = event as unknown as {
    id: string;
    title: string;
    date: string;
    time: string | null;
    location: string | null;
    state: string | null;
    price: number | null;
    cover_image_url: string | null;
  };

  // What this viewer has already done, so the nudge can name the gaps rather
  // than telling everybody to "complete your profile".
  const { data: me } = user
    ? await supabase
        .from("users")
        .select("name, avatar_url, bio, state, instagram_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: existing } = user
    ? await supabase
        .from("rsvps")
        .select("id, status")
        .eq("event_id", ev.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const profile = me as {
    name: string | null;
    avatar_url: string | null;
    bio: string | null;
    state: string | null;
    instagram_url: string | null;
  } | null;

  const gaps = profile
    ? [
        !profile.avatar_url && "a photo",
        !(profile.bio && profile.bio.trim().length >= 20) && "a short bio",
        !profile.state && "your state",
        !profile.instagram_url && "your Instagram",
      ].filter(Boolean as unknown as (v: unknown) => v is string)
    : [];

  return (
    <div>
      <AppHeader title="Claim a ticket" back />
      <div className="container-page max-w-lg py-5">
        {/* --- what is on offer --- */}
        <div className="overflow-hidden rounded-3xl bg-brand text-white">
          {ev.cover_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={ev.cover_image_url}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
          )}
          <div className="p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              {slot.tier_name}
            </p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.03em]">
              {ev.title}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-[15px] text-white/85">
              <LineIcon name="calendar" size={15} />
              {formatEventDate(ev.date)}
              {ev.time ? ` · ${ev.time.slice(0, 5)}` : ""}
            </p>
            {ev.location && (
              <p className="mt-1 flex items-start gap-2 text-[15px] text-white/85">
                <LineIcon name="pin" size={15} className="mt-0.5 shrink-0" />
                {ev.location}
              </p>
            )}
            {!!ev.price && ev.price > 0 && (
              <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold">
                Normally ₦{ev.price.toLocaleString("en-NG")}. Free here.
              </p>
            )}
          </div>
        </div>

        {/* --- how many are left --- */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.1em] text-gray-400">
              Slots
            </p>
            <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-gray-900 dark:text-white">
              {slot.remaining === null
                ? "Open"
                : `${slot.remaining} of ${slot.quantity} left`}
            </p>
          </div>
          {!slot.is_open && (
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-600 dark:bg-white/10 dark:text-white/70">
              Closed
            </span>
          )}
        </div>

        {/* --- the claim --- */}
        <div className="mt-4">
          <ClaimSlot
            eventId={ev.id}
            tierId={slot.tier_id}
            isOpen={slot.is_open}
            isLoggedIn={!!user}
            existingStatus={
              (existing as { status?: string } | null)?.status ?? null
            }
            code={params.code}
          />
        </div>

        {/* --- the rules, said out loud --- */}
        <div className="mt-6 space-y-3 rounded-2xl bg-gray-50 p-4 text-[14px] leading-snug text-gray-600 dark:bg-white/5 dark:text-white/65">
          <p>
            <span className="font-bold text-gray-900 dark:text-white">
              Claiming holds your place in the queue.
            </span>{" "}
            It is not a ticket yet. When the slots are gone, claiming closes.
          </p>
          <p>
            <span className="font-bold text-gray-900 dark:text-white">
              The host decides who comes.
            </span>{" "}
            Your claim lands with every other request and they say yes or no.
          </p>
          <p>
            <span className="font-bold text-gray-900 dark:text-white">
              A fuller profile gets read first.
            </span>{" "}
            Hosts work down the list and stop. Being further up is worth more
            than being early.
          </p>
        </div>

        {/* --- and what that means for this person specifically --- */}
        {user && gaps.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[14px] font-bold text-amber-900">
              Add {gaps.slice(0, 2).join(" and ")} to move up the list
            </p>
            <p className="mt-1 text-[13px] leading-snug text-amber-800/80">
              {gaps.length > 2
                ? `Still missing: ${gaps.join(", ")}.`
                : "It takes about a minute."}
            </p>
            <Link
              href="/profile/edit"
              className="mt-3 inline-flex rounded-full bg-amber-900 px-4 py-2 text-[13px] font-bold text-white"
            >
              Finish my profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
