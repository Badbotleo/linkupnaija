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
        subtitle="List your venue or services and get booked"
        back
      />

      <section className="container-page py-5">
        {/* What this page is for, in one honest line rather than a hero band */}
        <div className="mb-5 flex flex-wrap gap-2">
          {["Earn from events", "Free to list", "You set your rates"].map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700"
            >
              <LineIcon name="check" size={13} className="text-naija-600" />
              {c}
            </span>
          ))}
        </div>

        <OpportunityHubs />

        {/* Corporate — a tappable row, the way an app links onward */}
        <Link
          href="/corporate"
          className="group mt-4 flex items-center gap-4 surface p-4 transition hover:border-brand/30 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
            <LineIcon name="building" size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-gray-900 group-hover:text-brand">
              Corporate events
            </h3>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
              Team outings, client entertainment and retreats — we handle it.
            </p>
          </div>
          <LineIcon
            name="chevronRight"
            size={18}
            className="shrink-0 text-gray-300 transition group-hover:text-brand"
          />
        </Link>
      </section>
    </div>
  );
}
