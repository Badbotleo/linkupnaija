import CountUp from "./anim/CountUp";

// Honest, live platform stats — no inflated numbers.
//
// But honest isn't the same as helpful. A visitor deciding whether to sign up
// reads "54 Members" as "nobody is here", and an animated count-up puts a
// spotlight on it. So counts that depend on scale only appear once they
// support the pitch instead of undermining it; below the floor they're simply
// omitted, never rounded up or invented.
//
// Coverage and categories are shown always: 36 states and ~96 categories are
// true on day one and impressive at any size, because they describe what the
// platform does rather than how many people have found it yet.
export default function LandingStats({
  eventsCount,
  membersCount,
  categoriesCount,
}: {
  eventsCount: number;
  membersCount: number;
  categoriesCount: number;
}) {
  // Raise this as the numbers grow; the section switches itself on.
  const FLOOR = 250;

  const stats = [
    ...(eventsCount >= FLOOR
      ? [{ end: eventsCount, suffix: "", label: "Link-ups hosted" }]
      : []),
    ...(membersCount >= FLOOR
      ? [{ end: membersCount, suffix: "", label: "Members" }]
      : []),
    { end: 36, suffix: "", label: "States supported" },
    { end: categoriesCount, suffix: "", label: "Event categories" },
  ];

  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div
        className={`container-page grid gap-6 py-12 ${
          stats.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <CountUp
              end={s.end}
              suffix={s.suffix}
              className="block text-4xl font-extrabold text-brand sm:text-5xl"
            />
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
