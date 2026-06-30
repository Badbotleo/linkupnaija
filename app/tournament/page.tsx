import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import PsSymbols from "@/components/tournament/PsSymbols";
import TournamentRegistration from "@/components/tournament/TournamentRegistration";
import SlotCounter from "@/components/tournament/SlotCounter";
import Countdown from "@/components/tournament/Countdown";
import QrCode from "@/components/qr/QrCode";
import { TOURNAMENT } from "@/lib/tournament";
import { formatNaira } from "@/lib/paystack";
import { SITE_ORIGIN } from "@/lib/qr";

export const metadata = {
  title: "FC26 Tournament — Abuja",
  description:
    "Abuja's first PS5 FC26 tournament. ₦2,000,000 prize, winner takes all. 40 players only — register for ₦10,000.",
};

const DARK = "#0F0A2E";
const GOLD = "#FAC775";

const STEPS = [
  { n: 1, title: "Register online", text: "Pay ₦10,000 to secure your spot." },
  { n: 2, title: "Get confirmed", text: "Receive confirmation and your waitlist position." },
  { n: 3, title: "Pay at venue", text: "Pay the ₦50,000 pool fee on tournament day." },
  { n: 4, title: "Compete & win", text: "Battle 1v1 and win ₦2,000,000." },
];

const RULES = [
  "1v1 knockout format.",
  "Best of three matches per round.",
  "Standard FC26 settings — no custom teams, no house rules.",
  "No-shows forfeit their ₦10,000 registration fee.",
  "Pool fee (₦50,000) is refunded if the tournament is cancelled by the organizer.",
];

export default function TournamentPage() {
  return (
    <div style={{ backgroundColor: DARK }} className="text-white">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* pitch stripes */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 44px, transparent 44px 88px)",
          }}
          aria-hidden
        />
        {/* purple glow */}
        <div
          className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(83,74,183,0.45)" }}
          aria-hidden
        />
        <PsSymbols />

        <div className="container-page relative py-6">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="LinkUpNaija home">
            <LogoMark size={32} />
            <span className="text-lg font-extrabold">
              LinkUp<span style={{ color: "#7F77DD" }}>Naija</span>
            </span>
          </Link>
        </div>

        <div className="container-page relative flex flex-col items-center py-12 text-center sm:py-20">
          <span className="rounded-full border border-[#FAC775]/50 bg-[#FAC775]/10 px-3 py-1 text-xs font-bold tracking-widest text-[#FAC775]">
            WINNER TAKES ALL
          </span>
          <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">
            FC26 TOURNAMENT
          </h1>
          <p className="mt-3 text-lg text-white/70">
            Abuja&apos;s first PS5 FC26 tournament
          </p>

          <p className="mt-8 text-sm font-bold uppercase tracking-widest text-white/50">
            Prize pool
          </p>
          <p className="text-6xl font-black sm:text-8xl" style={{ color: GOLD }}>
            <SlotCounter value={TOURNAMENT.prize} />
          </p>

          <a
            href="#register"
            className="mt-10 rounded-xl bg-gradient-to-r from-[#534AB7] to-[#7F77DD] px-8 py-3.5 text-base font-bold text-white transition hover:opacity-90"
          >
            Register Now — {formatNaira(TOURNAMENT.regFee)}
          </a>
        </div>
      </section>

      {/* ===== DETAILS ===== */}
      <section className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard borderColor="#534AB7" title="40 Players Only" sub="Limited spots — first come, first served" />
          <InfoCard borderColor="#22C55E" title={`${formatNaira(TOURNAMENT.regFee)} Registration`} sub="Pay online to secure your spot" />
          <InfoCard borderColor={GOLD} title={`${formatNaira(TOURNAMENT.poolFee)} Pool Entry`} sub="Pay at the venue on the day" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
            Total per player: {formatNaira(TOURNAMENT.totalPerPlayer)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 text-center sm:grid-cols-3">
          <Meta label="Format" value="1v1 Knockout · Best of Three" />
          <Meta label="Date" value="To be announced" />
          <Meta label="Venue" value="Abuja — TBA" />
        </div>

        {/* Countdown (pass an ISO date string here once announced) */}
        <Countdown date={null} />
      </section>

      {/* ===== HOW TO ENTER ===== */}
      <section className="container-page py-12">
        <h2 className="text-center text-3xl font-black">How to enter</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-xl text-lg font-black text-[#0F0A2E]"
                style={{ backgroundColor: GOLD }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-white/60">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== REGISTER ===== */}
      <section id="register" className="container-page max-w-xl py-12">
        <h2 className="text-center text-3xl font-black">Secure your spot</h2>
        <p className="mt-2 text-center text-white/60">
          Pay {formatNaira(TOURNAMENT.regFee)} online to register. The{" "}
          {formatNaira(TOURNAMENT.poolFee)} pool entry is paid at the venue.
        </p>
        <div className="mt-8">
          <TournamentRegistration />
        </div>

        {/* Shareable QR for physical flyers */}
        <div
          className="mt-10 flex flex-col items-center rounded-2xl border-2 p-6"
          style={{ borderColor: GOLD, backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <p
            className="text-sm font-black uppercase tracking-wide"
            style={{ color: GOLD }}
          >
            Spread the word
          </p>
          <p className="mt-1 text-center text-sm text-white/60">
            Print this on flyers — scan to register for the FC26 tournament.
          </p>
          <div className="mt-5">
            <QrCode
              value={`${SITE_ORIGIN}/tournament`}
              caption="Scan to register"
              fileName="fc26-tournament-qr"
              copyValue={`${SITE_ORIGIN}/tournament`}
              dark
            />
          </div>
        </div>
      </section>

      {/* ===== RULES ===== */}
      <section className="container-page max-w-2xl py-12">
        <h2 className="text-center text-3xl font-black">Rules</h2>
        <ul className="mt-6 space-y-3">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-3">
              <span style={{ color: GOLD }} aria-hidden>
                ▸
              </span>
              <span className="text-white/80">{r}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm text-white/50 hover:text-white">
            ← Back to LinkUpNaija
          </Link>
        </div>
      </section>

      {/* green flag accent strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: "#008753" }} />
    </div>
  );
}

function InfoCard({
  borderColor,
  title,
  sub,
}: {
  borderColor: string;
  title: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-2xl border-2 bg-[#1A1040] p-6 text-center"
      style={{ borderColor }}
    >
      <p className="text-xl font-extrabold">{title}</p>
      <p className="mt-1 text-sm text-white/60">{sub}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
