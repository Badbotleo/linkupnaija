import CorporateInquiryForm from "@/components/corporate/CorporateInquiryForm";

export const metadata = {
  title: "For Business · Corporate Events",
  description:
    "Plan unforgettable team events with LinkUpNaija. Team outings, client entertainment, company picnics and retreats. We handle everything.",
};

const PLANS = [
  {
    name: "Starter",
    price: "₦50,000",
    unit: "/event",
    featured: false,
    features: [
      "Up to 20 attendees",
      "Venue recommendations",
      "Event management",
      "Attendee RSVP management",
      "Post-event gallery",
    ],
  },
  {
    name: "Professional",
    price: "₦150,000",
    unit: "/event",
    featured: true,
    features: [
      "Up to 50 attendees",
      "Dedicated event coordinator",
      "Custom invitations",
      "Catering coordination via partner venues",
      "Photography coordination",
      "Post-event report",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "pricing",
    featured: false,
    features: [
      "Unlimited attendees",
      "Multiple events per month",
      "Dedicated account manager",
      "Custom branded event pages",
      "Analytics dashboard",
      "Priority support",
    ],
  },
];

export default function CorporatePage() {
  return (
    <div>
      {/* Hero */}
      <section className="text-white" style={{ backgroundColor: "#1A1040" }}>
        <div className="container-page py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-[#FAC775]">
            For Business
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Plan unforgettable team events with LinkUpNaija
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#DAD8F0]">
            From team outings to client entertainment, we handle everything.
          </p>
          <a href="#quote" className="btn mt-8 inline-block bg-[#FAC775] px-6 py-3 text-base font-bold text-[#1A1040] hover:opacity-90">
            Get a quote →
          </a>
        </div>
      </section>

      {/* Plans */}
      <section className="container-page py-14">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Plans for every team
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-card ${
                plan.featured ? "border-brand ring-2 ring-brand/20" : "border-gray-100"
              }`}
            >
              {plan.featured && (
                <span className="mb-3 self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-extrabold text-gray-900">{plan.name}</h3>
              <p className="mt-2">
                <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm font-medium text-gray-500"> {plan.unit}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-brand" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#quote"
                className={`mt-6 w-full rounded-xl py-2.5 text-center text-sm font-bold transition ${
                  plan.featured
                    ? "bg-brand text-white hover:bg-brand-600"
                    : "border border-gray-200 text-gray-800 hover:bg-gray-50"
                }`}
              >
                {plan.name === "Enterprise" ? "Contact sales" : "Get started"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Quote form */}
      <section id="quote" className="bg-gray-50 py-14">
        <div className="container-page max-w-3xl">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Tell us about your event
            </h2>
            <p className="mt-2 text-gray-600">
              Share a few details and we&apos;ll come back with a tailored proposal.
            </p>
          </div>
          <CorporateInquiryForm />
        </div>
      </section>
    </div>
  );
}
