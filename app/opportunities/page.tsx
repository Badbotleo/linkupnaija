import OpportunityHubs from "@/components/opportunities/OpportunityHubs";

export const metadata = {
  title: "Opportunities",
  description:
    "Grow your business with LinkUpNaija — list cars for hire, get booked as a photographer, or list your venue.",
};

export default function OpportunitiesPage() {
  return (
    <div>
      {/* Hero */}
      <section
        className="text-white"
        style={{ backgroundColor: "#1A1040" }}
      >
        <div className="container-page py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Grow your business with LinkUpNaija
          </h1>
          <p className="mt-4 text-lg text-[#DAD8F0]">
            Connect with thousands of event-goers across Nigeria
          </p>
        </div>
      </section>

      {/* Hubs */}
      <section className="container-page py-12">
        <OpportunityHubs />
      </section>
    </div>
  );
}
