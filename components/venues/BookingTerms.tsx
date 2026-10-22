import LineIcon from "@/components/ui/LineIcon";
import { formatNaira } from "@/lib/paystack";

export interface BookingOption {
  label: string;
  detail: string;
  /** Naira, or null when the option has no fixed figure. */
  amount?: number | null;
}

/**
 * What it takes to book this place, printed before anybody asks.
 *
 * WHY THIS EXISTS. The Curiosities Book Club wrote to Luna Cafe about a date
 * and got a reply setting out three ways to reserve: pre-order seven or
 * eight items, use the set menu, or leave a N100,000 non-refundable deposit.
 * The host read that as "too many policies" and the booking soured.
 *
 * Luna's terms are not unreasonable. A cafe handing a room to twenty people
 * on a Saturday needs one of those three, and plenty of places ask for more.
 * What went wrong is that he met them AFTER introducing himself, as a reply
 * to an approach he had already made, which is the moment any condition
 * reads as a hurdle rather than as information.
 *
 * The same three lines on this page, before he ever made contact, are a
 * venue that knows how it works. So the terms are published, the group picks
 * one on the way in, and the venue stops explaining itself one email at a
 * time.
 *
 * SILENT WHEN THERE IS NOTHING TO SAY. A venue with no terms set gets no
 * block at all rather than an empty one promising detail that is not there.
 */
export default function BookingTerms({
  options,
  noticeDays,
  note,
  capacity,
  minSpend,
  freeEventsOk,
}: {
  options: BookingOption[];
  noticeDays: number | null;
  note: string | null;
  capacity: number | null;
  /** A threshold, not a choice, and always one figure. */
  minSpend: number | null;
  /** null means nobody has asked them yet, which is said out loud. */
  freeEventsOk: boolean | null;
}) {
  const hasAny =
    options.length > 0 ||
    !!noticeDays ||
    !!note ||
    !!capacity ||
    !!minSpend ||
    freeEventsOk !== null;
  if (!hasAny) return null;

  return (
    <section className="surface p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand dark:bg-white/[0.06]">
          <LineIcon name="shield" size={16} />
        </span>
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-gray-900 dark:text-white">
          Booking this place
        </h2>
      </div>

      {/* MINIMUM SPEND IS NOT ONE OF THE OPTIONS. It applies whichever one
          you pick, so it sits above them where a threshold belongs. A free
          event cannot promise a spend at all, which is the single fact that
          decided the book club booking and the one nobody had written
          down. */}
      {(minSpend || freeEventsOk !== null) && (
        <div className="mt-3 space-y-2">
          {!!minSpend && (
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-3 dark:bg-amber-500/10">
              <span className="text-[14px] font-bold text-amber-900 dark:text-amber-200">
                Minimum spend for a group
              </span>
              <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-amber-900 dark:text-amber-200">
                {formatNaira(minSpend)}
              </span>
            </div>
          )}
          {freeEventsOk === true && (
            <p className="flex items-start gap-2 rounded-xl bg-naija-50 px-3.5 py-3 text-[13.5px] leading-snug text-naija-800 dark:bg-naija-500/10 dark:text-naija-200">
              <LineIcon name="check" size={15} className="mt-0.5 shrink-0" />
              Happy to host a free event with no guaranteed spend.
            </p>
          )}
          {freeEventsOk === false && (
            <p className="flex items-start gap-2 rounded-xl bg-gray-100 px-3.5 py-3 text-[13.5px] leading-snug text-gray-700 dark:bg-white/[0.06] dark:text-white/75">
              <LineIcon name="x" size={15} className="mt-0.5 shrink-0" />
              They do not take free events with no guaranteed spend.
            </p>
          )}
        </div>
      )}

      {options.length > 0 && (
        <>
          <p className="mt-2 text-[13.5px] text-gray-500">
            For a group, pick whichever of these suits you. You choose on the
            request form.
          </p>
          <ol className="mt-3 space-y-2">
            {options.map((o, i) => (
              <li
                key={`${o.label}-${i}`}
                className="flex gap-3 rounded-xl bg-gray-50 px-3.5 py-3 dark:bg-white/[0.04]"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[12px] font-extrabold text-brand shadow-[var(--e1)] dark:bg-white/10">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[14.5px] font-bold text-gray-900 dark:text-white">
                      {o.label}
                    </span>
                    {typeof o.amount === "number" && o.amount > 0 && (
                      <span className="text-[14px] font-extrabold tabular-nums text-brand">
                        {formatNaira(o.amount)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug text-gray-600 dark:text-white/70">
                    {o.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* The two facts that decide whether a request is even worth sending,
          and the two most common reasons one gets declined. */}
      {(noticeDays || capacity) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {noticeDays ? (
            <Fact
              icon="clock"
              text={`${noticeDays} day${noticeDays === 1 ? "" : "s"} notice`}
            />
          ) : null}
          {capacity ? <Fact icon="users" text={`Up to ${capacity} people`} /> : null}
        </div>
      )}

      {note && (
        <p className="mt-3 text-[13.5px] leading-snug text-gray-600 dark:text-white/70">
          {note}
        </p>
      )}
    </section>
  );
}

function Fact({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-[12.5px] font-bold text-gray-700 dark:bg-white/[0.08] dark:text-white/80">
      <LineIcon name={icon} size={13} />
      {text}
    </span>
  );
}

/**
 * Reads whatever is in the jsonb column without trusting its shape.
 *
 * The column is owner-editable, so a malformed row must render as "no terms"
 * rather than take the venue page down with it.
 */
export function parseBookingOptions(raw: unknown): BookingOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const detail = typeof o.detail === "string" ? o.detail.trim() : "";
    if (!label) return [];
    const amount =
      typeof o.amount === "number" && Number.isFinite(o.amount)
        ? Math.max(0, Math.round(o.amount))
        : null;
    return [{ label, detail, amount }];
  });
}
