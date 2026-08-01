import Link from "next/link";
import LineIcon from "@/components/ui/LineIcon";
import PsSymbols from "@/components/tournament/PsSymbols";
import TournamentRegistration from "@/components/tournament/TournamentRegistration";
import SlotCounter from "@/components/tournament/SlotCounter";
import Countdown from "@/components/tournament/Countdown";
import QrCode from "@/components/qr/QrCode";
import { TOURNAMENT } from "@/lib/tournament";
import { formatNaira } from "@/lib/paystack";
import { SITE_ORIGIN } from "@/lib/qr";

export const metadata = {
  title: "FC26 Tournament · Abuja",
  description:
    "Abuja's first PS5 FC26 tournament. ₦2,000,000 prize, winner takes all. 40 players only. Register for ₦10,000.",
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
  "Standard FC26 settings: no custom teams, no house rules.",
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

        {/* Screen bar. No brand lockup here — the global navbar already carries
            it, and two wordmarks stacked read as a broken page. */}
        <div className="container-page relative flex items-center gap-3 py-4">
          <Link
            href="/"
            aria-label="Back to LinkUpNaija"
            className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <LineIcon name="chevronLeft" size={20} />
          </Link>
          <span className="text-sm font-bold text-white/60">Tournament</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#FAC775] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#0F0A2E]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0F0A2E] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0F0A2E]" />
            </span>
            Now on
          </span>
        </div>

        {/* Title block — left-aligned like a screen, not a centred billboard */}
        <div className="container-page relative pb-8 pt-1">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FAC775]">
            Winner takes all
          </p>
          <h1 className="mt-2 text-[34px] font-black leading-[1.02] tracking-tight sm:text-5xl">
            FC26 Tournament
          </h1>
          <p className="mt-1.5 text-white/60">
            Abuja&apos;s first PS5 FC26 tournament
          </p>

          {/* Prize as a card you could tap in an app, not a full-bleed splash */}
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
              Prize pool
            </p>
            <p className="mt-1 text-[44px] font-black leading-none sm:text-6xl" style={{ color: GOLD }}>
              <SlotCounter value={TOURNAMENT.prize} />
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                `${formatNaira(TOURNAMENT.regFee)} to register`,
                "40 players only",
                "1v1 knockout",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DETAILS ===== */}
      <section className="container-page py-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoCard borderColor="#534AB7" title="40 Players Only" sub="Limited spots. First come, first served" />
          <InfoCard borderColor="#22C55E" title={`${formatNaira(TOURNAMENT.regFee)} Registration`} sub="Pay online to secure your spot" />
          <InfoCard borderColor={GOLD} title={`${formatNaira(TOURNAMENT.poolFee)} Pool Entry`} sub="Pay at the venue on the day" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
            Total per player: {formatNaira(TOURNAMENT.totalPerPlayer)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Meta label="Format" value="1v1 Knockout · Best of Three" />
          <Meta label="Date" value="To be announced" />
          <Meta label="Venue" value="Abuja (TBA)" />
        </div>

        {/* Countdown (pass an ISO date string here once announced) */}
        <Countdown date={null} />
      </section>

      {/* ===== HOW TO ENTER ===== */}
      <section className="container-page py-8">
        <h2 className="text-[19px] font-extrabold tracking-tight">How to enter</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      <section id="register" className="container-page max-w-xl py-8">
        <h2 className="text-[19px] font-extrabold tracking-tight">Secure your spot</h2>
        <p className="mt-1 text-sm text-white/60">
          Pay {formatNaira(TOURNAMENT.regFee)} online to register. The{" "}
          {formatNaira(TOURNAMENT.poolFee)} pool entry is paid at the venue.
        </p>
        <div className="mt-4">
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
            Print this on flyers. Scan to register for the FC26 tournament.
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
      <section className="container-page max-w-2xl py-8">
        <h2 className="text-[19px] font-extrabold tracking-tight">Rules</h2>
        <ul className="mt-4 space-y-2.5">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-2.5">
              <LineIcon
                name="check"
                size={15}
                className="mt-0.5 shrink-0 text-[#FAC775]"
              />
              <span className="text-sm leading-relaxed text-white/80">{r}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* green flag accent strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: "#008753" }} />

      {/* Sticky action bar — one primary action, always in thumb reach, the way
          a native event screen keeps "Register" pinned. */}
      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#0F0A2E]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="container-page flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
              Prize pool
            </p>
            <p className="truncate text-lg font-black leading-tight" style={{ color: GOLD }}>
              {formatNaira(TOURNAMENT.prize)}
            </p>
          </div>
          <a
            href="#register"
            className="shrink-0 rounded-full bg-gradient-to-r from-[#534AB7] to-[#7F77DD] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Register · {formatNaira(TOURNAMENT.regFee)}
          </a>
        </div>
      </div>
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
  // Left-aligned with a colour rail rather than a centred outlined billboard.
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-4 pl-5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: borderColor }}
      />
      <p className="font-extrabold leading-snug">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-white/60">{sub}</p>
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
