import LineIcon from "../ui/LineIcon";
import { quorumLabel, quorumProgress, type QuorumState } from "@/lib/quorum";

/**
 * The counter that makes an empty room worth joining.
 *
 * This is the only place on the site where a low number is an asset. Everywhere
 * else we hide small counts because "2 going" reads as a warning; here the gap
 * between 2 and the target is the reason to tap — you are not being asked to
 * turn up alone, you are being asked to be the fourth of six.
 *
 * So it shows the real number at any size, and never says "be the first".
 */
export default function QuorumMeter({ state }: { state: QuorumState }) {
  if (state.kind === "none") return null;

  const label = quorumLabel(state);
  const pct = Math.round(quorumProgress(state) * 100);

  if (state.kind === "failed") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5">
        <p className="text-[14px] font-bold text-gray-600">{label}</p>
        <p className="mt-0.5 text-[13px] text-gray-500">
          It needed {state.need} and got {state.going}. Nobody was left standing
          around — that&apos;s the point.
        </p>
      </div>
    );
  }

  if (state.kind === "met") {
    return (
      <div className="rounded-2xl border border-naija/30 bg-naija-50 p-3.5">
        <p className="flex items-center gap-2 text-[15px] font-extrabold text-naija-700">
          <LineIcon name="check" size={16} />
          {label}
        </p>
        <p className="mt-0.5 text-[13px] text-naija-700/80">
          {state.going} people confirmed. This one&apos;s on.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand/25 bg-brand/[0.05] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-extrabold text-brand">{label}</p>
        <p className="shrink-0 text-[13px] font-bold tabular-nums text-gray-500">
          {state.going}/{state.need}
        </p>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand/15"
        role="progressbar"
        aria-valuenow={state.going}
        aria-valuemin={0}
        aria-valuemax={state.need}
        aria-label={`${state.going} of ${state.need} guests needed`}
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-[13px] leading-snug text-gray-600">
        Ask to join now and you&apos;re only in if it fills. Nobody turns up to
        an empty room.
      </p>
    </div>
  );
}
