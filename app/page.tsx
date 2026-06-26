import Link from "next/link";
import { EVENT_CATEGORIES, CATEGORY_STYLES } from "@/lib/constants";
import FcPopup from "@/components/FcPopup";

const HOW_IT_WORKS = [
  {
    emoji: "🔎",
    title: "Find your vibe",
    text: "Browse hangouts, parties, picnics and more happening in your state.",
  },
  {
    emoji: "🙌",
    title: "Join the link-up",
    text: "Tap join to RSVP and see who else is pulling up. No stress.",
  },
  {
    emoji: "🎤",
    title: "Or host your own",
    text: "Got a vibe in mind? Create an event and gather your people.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-white">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand">
              🇳🇬 Nigeria&apos;s social events platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Link up. <span className="text-brand">Hang out.</span> Vibe.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-gray-600">
              From clubbing in Lagos to book clubs in Abuja and picnics in PH —
              find your people and your next outing on LinkUpNaija.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events" className="btn-primary px-6 py-3 text-base">
                Explore events
              </Link>
              <Link href="/signup" className="btn-outline px-6 py-3 text-base">
                Join free
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {EVENT_CATEGORIES.slice(0, 4).map((cat, i) => {
                const { emoji, badge } = CATEGORY_STYLES[cat];
                return (
                  <div
                    key={cat}
                    className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-card ${
                      i % 2 === 0 ? "translate-y-3" : ""
                    }`}
                  >
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-xl text-2xl ${badge}`}
                    >
                      {emoji}
                    </span>
                    <p className="mt-3 font-bold text-gray-900">{cat}</p>
                    <p className="text-sm text-gray-500">Find one near you</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          Three steps to never having a boring weekend again.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-2xl">
                  {step.emoji}
                </span>
                <span className="text-sm font-bold text-brand">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                {step.title}
              </h3>
              <p className="mt-1.5 text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gray-50 py-16">
        <div className="container-page">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Pick your vibe
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
            Whatever your energy, there&apos;s a link-up for it.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {EVENT_CATEGORIES.map((cat) => {
              const { emoji, badge } = CATEGORY_STYLES[cat];
              return (
                <Link
                  key={cat}
                  href={`/events?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand/30"
                >
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${badge}`}
                  >
                    {emoji}
                  </span>
                  <span className="font-bold text-gray-900 group-hover:text-brand">
                    {cat}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-16">
        <div className="overflow-hidden rounded-3xl bg-brand px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Ready to link up?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-100">
            Join thousands of Nigerians finding their next hangout. It&apos;s
            free and takes 30 seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="btn bg-white px-6 py-3 text-base text-brand hover:bg-brand-50"
            >
              Create your account
            </Link>
            <Link
              href="/events"
              className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10"
            >
              Browse events
            </Link>
          </div>
        </div>
      </section>

      <FcPopup />
    </div>
  );
}
