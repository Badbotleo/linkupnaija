import LineIcon from "@/components/ui/LineIcon";
import Link from "next/link";
import OpportunityHubs from "@/components/opportunities/OpportunityHubs";

export const metadata = {
  title: "Opportunities",
  description:
    "Grow your business with LinkUpNaija: list cars for hire, get booked as a photographer, or list your venue.",
};

export default function OpportunitiesPage() {
  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
      >
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#534AB7]/30 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#FAC775]/15 blur-[100px]" />
        <div className="container-page relative py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Grow your business with <span className="text-[#FAC775]">LinkUpNaija</span>
          </h1>
          <p className="mt-4 text-lg text-white/70">
            Connect with thousands of event-goers across Nigeria
          </p>
        </div>
      </section>

      {/* Hubs */}
      <section className="container-page py-12">
        <OpportunityHubs />

        {/* Corporate */}
        <Link
          href="/corporate"
          className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand">
              <LineIcon name="building" size={24} />
            </span>
            <h3 className="mt-3 text-lg font-extrabold text-gray-900">
              Corporate Events
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Plan unforgettable team outings, client entertainment and
              retreats. We handle everything.
            </p>
          </div>
          <span className="btn-primary shrink-0">For Business →</span>
        </Link>
      </section>
    </div>
  );
}
