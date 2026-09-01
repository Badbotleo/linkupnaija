import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";

/**
 * About us.
 *
 * Written because Termii asked for one during SMS sender ID verification, and
 * the site did not have a page saying who runs it. That is a real gap beyond
 * the ticket: a platform that takes ticket money, holds a guest list and sends
 * strangers to each other's addresses should be able to say what it is and how
 * to reach a person.
 *
 * Every claim here is checkable against the product. No founding myth, no
 * team headcount, no registration details invented to look established.
 */

export const metadata = {
  title: "About us",
  description:
    "LinkUpNaija is a Nigerian platform for finding and hosting real-life link-ups: hangouts, parties, picnics, book clubs, game nights and more. Every guest is approved by the host.",
  alternates: { canonical: "/about" },
};

const WHAT = [
  {
    icon: "search",
    title: "Find something to go to",
    body: "Browse link-ups across Nigeria by city and by vibe, from rooftop parties to book clubs to five-a-side. Most are free.",
  },
  {
    icon: "users",
    title: "Ask to join, and the host decides",
    body: "There is no open door. You send a request, the host reads your profile and approves or declines. That is the whole safety model, and it is deliberate.",
  },
  {
    icon: "sparkles",
    title: "Or host your own",
    body: "Listing is free and takes a couple of minutes. Hosts can sell tickets, and we take a small platform fee on paid sales.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <AppHeader title="About us" subtitle="Who we are and what this is" back />

      <div className="container-page max-w-[720px] py-4">
        <section className="rounded-2xl bg-white p-5 shadow-[var(--e1)] dark:bg-white/[0.04]">
          <p className="text-[17px] font-bold leading-snug text-gray-900 dark:text-white">
            LinkUpNaija is a Nigerian platform for meeting people in real life.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-white/70">
            People move to a new city, finish school, come back from abroad or
            simply drift from their circle, and discover that adult friendship
            has no obvious front door. Nigeria has no shortage of things
            happening; what it lacks is a way to find the ones near you and turn
            up without already knowing somebody there.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-white/70">
            That is what this is. Hangouts, parties, picnics, book clubs, game
            nights, conferences and everything between, hosted by ordinary
            people across Lagos, Abuja and the rest of the country, with a host
            approving every single guest.
          </p>
        </section>

        <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
          How it works
        </h2>
        <div className="divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
          {WHAT.map((w) => (
            <div key={w.title} className="flex items-start gap-3 px-4 py-4">
              <span
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/[0.08] text-brand"
                aria-hidden
              >
                <LineIcon name={w.icon} size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                  {w.title}
                </p>
                <p className="mt-1 text-[14px] leading-snug text-gray-600 dark:text-white/70">
                  {w.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Safety
        </h2>
        <section className="rounded-2xl bg-white p-5 shadow-[var(--e1)] dark:bg-white/[0.04]">
          <p className="text-[15px] leading-relaxed text-gray-600 dark:text-white/70">
            Hosts approve every guest, members can verify their phone number,
            guests can share their plans with a trusted contact before they go,
            and any member or listing can be reported from the page it appears
            on. Ratings and reviews are left by people who actually attended.
          </p>
        </section>

        <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-[0.12em] text-gray-400">
          Contact
        </h2>
        <section className="rounded-2xl bg-white p-5 shadow-[var(--e1)] dark:bg-white/[0.04]">
          <p className="text-[15px] text-gray-600 dark:text-white/70">
            We answer support ourselves, in-house.
          </p>
          <a
            href="mailto:support@linkupnaija.com"
            className="mt-3 inline-flex items-center gap-2 text-[15px] font-bold text-brand"
          >
            <LineIcon name="send" size={16} />
            support@linkupnaija.com
          </a>
          <p className="mt-4 text-[14px] text-gray-500">
            LinkUpNaija operates in Nigeria at{" "}
            <span className="font-semibold text-gray-700 dark:text-white/80">
              www.linkupnaija.com
            </span>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200/70 pt-4 dark:border-white/10">
            <Link href="/terms-of-service" className="btn-outline py-2 text-sm">
              Terms of service
            </Link>
            <Link href="/privacy-policy" className="btn-outline py-2 text-sm">
              Privacy policy
            </Link>
            <Link href="/events" className="btn-primary py-2 text-sm">
              Browse link-ups
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
