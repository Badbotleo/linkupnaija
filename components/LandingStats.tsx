import CountUp from "./anim/CountUp";

// Honest, live platform stats — no inflated numbers. "States supported" is the
// platform's coverage (all 36 + FCT), which is true regardless of where events
// have happened so far; the rest come from the database.
export default function LandingStats({
  eventsCount,
  membersCount,
  categoriesCount,
}: {
  eventsCount: number;
  membersCount: number;
  categoriesCount: number;
}) {
  const stats = [
    { end: eventsCount, suffix: "", label: "Events hosted" },
    { end: membersCount, suffix: "", label: "Members" },
    { end: 36, suffix: "", label: "States supported" },
    { end: categoriesCount, suffix: "", label: "Event categories" },
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="container-page grid grid-cols-2 gap-6 py-12 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <CountUp
              end={s.end}
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
