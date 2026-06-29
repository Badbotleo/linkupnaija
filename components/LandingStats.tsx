import CountUp from "./anim/CountUp";

export default function LandingStats({ eventsCount }: { eventsCount: number }) {
  const stats = [
    { end: Math.max(eventsCount, 500), suffix: "+", label: "Events hosted" },
    { end: 36, suffix: "", label: "States covered" },
    { end: 20, suffix: "+", label: "Categories" },
    { end: 2, prefix: "₦", suffix: "M", label: "Tournament prize" },
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="container-page grid grid-cols-2 gap-6 py-12 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <CountUp
              end={s.end}
              prefix={s.prefix}
              suffix={s.suffix}
              className="block text-4xl font-extrabold text-brand sm:text-5xl"
            />
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
