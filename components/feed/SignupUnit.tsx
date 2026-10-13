import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";

/**
 * The ask, inline, twice on the way down.
 *
 * Not a wall on arrival and not a sticky bar fighting the tab bar for the
 * bottom of the screen. A unit in the column, shaped like the cards around
 * it, placed where it buys something specific: after three events, when
 * there is finally something worth keeping, and after nine, when someone has
 * read the lot and is clearly looking.
 *
 * Both asks name what the account actually does. "Join LinkUpNaija" is a
 * request. "See who else is going" is an offer.
 */
export default function SignupUnit({
  variant,
  state,
}: {
  variant: "first" | "second";
  state: string | null;
}) {
  const first = variant === "first";

  return (
    <div className="rounded-2xl bg-brand-50 p-5 shadow-[var(--e1)] dark:bg-brand/15">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/80 text-brand dark:bg-white/10">
        <LineIcon name={first ? "users" : "calendar"} size={21} />
      </span>
      <h2 className="mt-3 text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">
        {first
          ? "See who else is going"
          : `Get told when something lands${state ? ` in ${state}` : ""}`}
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-gray-600 dark:text-white/70">
        {first
          ? "Every link-up above has a guest list. Make an account and you can see it, message the host, and save the ones you like."
          : "New link-ups go up most weeks. An account means you hear about them before they fill up, and your friends can see what you're going to."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/signup" className="btn-primary">
          Create an account
        </Link>
        <Link
          href="/login"
          className="rounded-full px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-white/60 dark:hover:bg-white/10"
        >
          I already have one
        </Link>
      </div>
    </div>
  );
}
