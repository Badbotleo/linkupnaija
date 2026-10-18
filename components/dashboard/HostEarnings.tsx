import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import { formatNaira } from "@/lib/paystack";

/**
 * What hosting has actually paid you.
 *
 * WHY THIS EXISTS. In the platform's whole life one payout has ever been
 * made, N1,350, and five hosts have ever come back for a second month. The
 * money machinery was not missing: payout cards, a request flow and a
 * "Withdraw" nudge were all built. What was missing is a number a host could
 * point at. Earnings existed only per event, in section six of an eight
 * section dashboard, so nobody ever saw "hosting has paid me N X" in one
 * place, and a reward you cannot see is not a reward.
 *
 * Four figures, in the order a host cares about them: what is theirs now,
 * what is still coming, what has already landed, and what the whole thing
 * adds up to.
 *
 * HONEST WHEN SMALL. At this stage the numbers are tiny, and they are shown
 * anyway. A card that only appears once the figures flatter us would be
 * worthless on the day it finally showed up, and a host who sold two tickets
 * wants to see two tickets.
 *
 * Renders for anybody who has ever sold one. Never for a host who has only
 * run free link-ups: a row of zeroes is not an incentive, it is a reminder.
 */
export default function HostEarnings({
  claimable,
  upcoming,
  paidOut,
  lifetime,
  eventsWithSales,
  hasPayoutDetails,
}: {
  /** Theirs now: sold, the night has passed, not yet requested. */
  claimable: number;
  /** Sold for link-ups that have not happened yet. */
  upcoming: number;
  /** Already transferred. */
  paidOut: number;
  /** Everything hosting has earned them, their share, all time. */
  lifetime: number;
  eventsWithSales: number;
  hasPayoutDetails: boolean;
}) {
  if (lifetime <= 0) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl text-white shadow-[var(--e2)]"
      style={{ background: "linear-gradient(135deg, #0A5C2E 0%, #121212 100%)" }}
    >
      <div className="px-5 pt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
          Hosting has paid you
        </p>
        <p className="mt-1 text-[38px] font-extrabold leading-none tabular-nums">
          {formatNaira(lifetime)}
        </p>
        <p className="mt-1.5 text-[13px] text-white/65">
          Across {eventsWithSales} link-up{eventsWithSales === 1 ? "" : "s"} that
          sold tickets
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
        <Figure label="Yours now" value={claimable} bright={claimable > 0} />
        <Figure label="Still coming" value={upcoming} />
        <Figure label="Paid out" value={paidOut} />
      </div>

      {/* One action, and only when there is a reason for it. */}
      {claimable > 0 && (
        <div className="border-t border-white/10 p-4">
          <Link
            href={hasPayoutDetails ? "#payouts" : "/profile/edit/payouts"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-[15px] font-bold text-[#0A5C2E] transition active:scale-[0.99]"
          >
            {hasPayoutDetails ? (
              <>
                Withdraw {formatNaira(claimable)}
                <LineIcon name="chevronRight" size={15} />
              </>
            ) : (
              <>
                <LineIcon name="shield" size={15} />
                Add your bank details to get paid
              </>
            )}
          </Link>
        </div>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  bright = false,
}: {
  label: string;
  value: number;
  bright?: boolean;
}) {
  return (
    <div className="px-3 py-3.5 text-center">
      <p
        className={`text-[17px] font-extrabold tabular-nums ${
          bright ? "text-white" : "text-white/75"
        }`}
      >
        {formatNaira(value)}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
        {label}
      </p>
    </div>
  );
}
