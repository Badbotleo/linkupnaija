"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The join button, kept within reach on a phone.
 *
 * Even with the title and date moved above the fold, the button itself sits
 * well down the page — past the flyer, the description and the host. Somebody
 * who has read enough to decide has to scroll back to act, and on a page this
 * long that is where people quietly leave.
 *
 * It FORWARDS the tap rather than rendering a second join button. RsvpButton
 * owns quorum, tiers, wallet balance, Paystack and the whole JoinSheet flow;
 * a copy of it down here would be a second implementation to keep in step, and
 * the first time they drifted the cheaper one would be the one taking money.
 * So this is a thin bar that clicks the real control.
 *
 * Mobile only. On a desktop the button is already beside the content.
 *
 * Portalled to <body>, which is not optional. Rendered in place it laid out at
 * 2037px on an 812px screen: a transformed ancestor becomes the containing
 * block for position:fixed, so "fixed to the bottom" quietly means "fixed to
 * the bottom of that ancestor". Measured, not guessed — and the sixth time
 * this pattern has bitten in this codebase.
 */
export default function StickyJoinBar({
  targetId,
  label,
  price,
}: {
  /** Wraps the real CTA. Its first button is what gets clicked. */
  targetId: string;
  label: string;
  /** Shown beside the button, not inside it. Null on a free link-up. */
  price?: string | null;
}) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    // Shown only while the real button is off screen. Floating a duplicate
    // over a button somebody can already see is just clutter.
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  if (!mounted || !show) return null;

  return createPortal(
    <div
      // Offset above the bottom nav rather than padded away from it.
      //
      // This was pb-[calc(64px+env(safe-area-inset-bottom))], and the missing
      // spaces made it invalid: calc() requires whitespace around the minus or
      // plus, so the browser dropped the declaration and the clearance never
      // existed. The bar sat at bottom-0 under a z-40 nav, which is why the
      // button it forwards to was partly covered on every phone.
      //
      // Underscores are how a space is written in Tailwind's arbitrary values.
      className="fixed inset-x-0 bottom-[calc(53px_+_env(safe-area-inset-bottom))] z-30 border-t border-gray-100 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-black/85"
    >
      <div className="flex items-center gap-3">
        {/* Price beside the button, not inside it. The button says what
            happens next and the number says what it costs, so neither has to
            shrink to fit the other. */}
        {price && (
          <div className="shrink-0">
            <p className="text-[19px] font-extrabold leading-none tracking-[-0.02em] text-gray-900 dark:text-white">
              {price}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-gray-500">
              per person
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            const target = document.getElementById(targetId);
            const real = target?.querySelector("button, a") as
              | HTMLElement
              | null;
            if (real) {
              real.click();
              return;
            }
            // If the control is not there to click, scrolling to where it
            // lives is still better than a tap that does nothing.
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="relative flex h-14 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-700 text-[17px] font-extrabold tracking-[-0.01em] text-white shadow-[0_10px_30px_-12px_rgba(83,74,183,0.9)] ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.97]"
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-white/40"
            aria-hidden
          />
          {label}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
