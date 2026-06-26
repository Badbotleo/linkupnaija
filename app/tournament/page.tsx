import Link from "next/link";

export const metadata = {
  title: "FC26 Tournament — Abuja",
  description:
    "Join the LinkUpNaija FC26 Tournament in Abuja — ₦2,000,000 prize pool, 40 players only.",
};

export default function TournamentPage() {
  return (
    <div
      className="min-h-[70vh] text-white"
      style={{ backgroundColor: "#0F0A2E" }}
    >
      <div className="container-page max-w-2xl py-16 text-center">
        <p className="text-sm font-black tracking-widest text-[#7F77DD]">
          🎮 FC26 TOURNAMENT — ABUJA
        </p>
        <h1 className="mt-4 text-5xl font-extrabold sm:text-6xl">
          ₦2,000,000
          <span className="block text-2xl font-bold text-white/70">
            prize pool
          </span>
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { big: "40", small: "players only" },
            { big: "₦10K", small: "online registration" },
            { big: "₦50K", small: "pool at venue" },
          ].map((s) => (
            <div
              key={s.small}
              className="rounded-2xl border-2 border-brand/60 p-5"
              style={{ backgroundColor: "#1A1040" }}
            >
              <p className="text-3xl font-extrabold">{s.big}</p>
              <p className="text-sm text-white/60">{s.small}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-white/70">
          Spots are limited to 40 players. Join the waitlist and we&apos;ll reach
          out with registration details.
        </p>

        <form
          className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          action="/tournament"
        >
          <input
            type="email"
            required
            placeholder="your@email.com"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-brand to-[#7F77DD] px-6 py-3 font-bold text-white hover:opacity-90"
          >
            Join Waitlist
          </button>
        </form>

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-white/50 hover:text-white"
        >
          ← Back to LinkUpNaija
        </Link>
      </div>
    </div>
  );
}
