import Link from "next/link";
import LineIcon from "../ui/LineIcon";

/**
 * The dashboard used to open with a heading and a wall of stacked sections —
 * everything one scroll away, nothing one tap away. This is the shortcut grid
 * a dashboard is supposed to open with: the six things people actually came
 * to do, as tinted tiles.
 *
 * Purple stays the single accent. The tints are backgrounds, not second
 * brand colours, so nothing competes with a real call to action.
 */
const ACTIONS: {
  href: string;
  label: string;
  hint: string;
  icon: string;
  tint: string;
}[] = [
  { href: "/host", label: "Host", hint: "Start a link-up", icon: "mic", tint: "from-brand-100 to-brand-50 text-brand-700" },
  { href: "/events", label: "Explore", hint: "What's on", icon: "search", tint: "from-naija-100 to-naija-50 text-emerald-800" },
  { href: "/circles", label: "Circles", hint: "Your communities", icon: "circles", tint: "from-amber-100 to-amber-50 text-amber-800" },
  { href: "/friends", label: "Friends", hint: "Your people", icon: "users", tint: "from-teal-100 to-teal-50 text-teal-800" },
  { href: "/rides", label: "Rides", hint: "Get there", icon: "car", tint: "from-blue-100 to-blue-50 text-blue-800" },
  { href: "/refer", label: "Refer", hint: "Earn credit", icon: "gift", tint: "from-rose-100 to-rose-50 text-rose-800" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-3 text-center transition hover:-translate-y-0.5 hover:shadow-card ${a.tint}`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70">
            <LineIcon name={a.icon} size={18} />
          </span>
          <span className="block w-full truncate text-[12.5px] font-extrabold">
            {a.label}
          </span>
          <span className="block w-full truncate text-[10.5px] opacity-70">
            {a.hint}
          </span>
        </Link>
      ))}
    </div>
  );
}
