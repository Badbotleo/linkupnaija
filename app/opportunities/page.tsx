import LineIcon from "@/components/ui/LineIcon";
import Link from "next/link";
import OpportunityHubs from "@/components/opportunities/OpportunityHubs";
import AppHeader from "@/components/AppHeader";

export const metadata = {
  title: "Opportunities",
  description:
    "Grow your business with LinkUpNaija: list cars for hire, get booked as a photographer, or list your venue.",
};

export default function OpportunitiesPage() {
  return (
    <div>
      <AppHeader
        title="Opportunities"
        subtitle="List your car, venue or services and get booked"
        back
      />

      {/* Hubs */}
      <section className="container-page py-8">
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
