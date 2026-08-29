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
}: {
  /** Wraps the real CTA. Its first button is what gets clicked. */
  targetId: string;
  label: string;
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
      // z-30 sits under the bottom nav's z-40, and the padding clears it, so
      // the bar stacks above navigation rather than covering it.
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 px-4 pb-[calc(64px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#121212]/95"
    >
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
          // If the control is not there to click, scrolling to where it lives
          // is still better than a tap that does nothing.
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="w-full rounded-2xl bg-brand px-5 py-3.5 text-[15px] font-bold text-white shadow-float transition active:scale-[0.99]"
      >
        {label}
      </button>
    </div>,
    document.body
  );
}
