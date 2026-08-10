import { formatNaira } from "@/lib/paystack";

/**
 * The "Buy Ticket" panel on an event page.
 *
 * The price used to be a small dark chip sitting in the badge row next to the
 * category and the state — the same weight as metadata, easy to miss, and it
 * gave the buyer nothing to read before deciding. This makes the ticket a
 * thing on the page: a tier label, the price at a size you can't miss, the
 * host's own line about what you're paying for, and the action beside it.
 *
 * The dashed outer edge with a solid card inset is deliberate — it reads as a
 * ticket stub rather than another content card, so it doesn't compete with
 * the event's own sections.
 *
 * Free events don't render this at all. "₦0" as a headline is a worse answer
 * than saying nothing and letting the join button speak.
 */
export default function TicketPanel({
  price,
  tier = "Standard",
  note,
  children,
}: {
  price: number;
  /** Shown above the price, e.g. "EARLY BIRD". */
  tier?: string;
  /** The host's line about what the ticket includes. */
  note?: string | null;
  /** The buy/join control, rendered beside the price. */
  children?: React.ReactNode;
}) {
  if (!price || price <= 0) return null;

  return (
    <section aria-labelledby="ticket-heading">
      <h2
        id="ticket-heading"
        className="text-xl font-extrabold text-gray-900 dark:text-white"
      >
        Buy Ticket
      </h2>

      <div className="mt-3 rounded-3xl border border-dashed border-gray-300 p-1.5 dark:border-white/20">
        <p className="px-4 py-2.5 text-[13px] font-black uppercase tracking-[0.12em] text-gray-600 dark:text-white/60">
          {tier}
        </p>

        <div className="rounded-[20px] bg-white p-5 shadow-sm dark:bg-white/[0.06]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              {/* tabular-nums keeps the ₦ and the digits from shifting as the
                  amount changes across events. */}
              <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
                {formatNaira(price)}
              </p>
              {note && (
                <p className="mt-2 text-[15px] leading-snug text-gray-500 dark:text-white/60">
                  {note}
                </p>
              )}
            </div>
            {children && <div className="shrink-0">{children}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
