import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";
import LineIcon from "@/components/ui/LineIcon";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in",
  description: "Log in to join events and host your own on LinkUpNaija.",
};

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/events");

  const [{ count: members }, { count: events }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { icon: "users", value: `${members ?? 0}`, label: "members" },
    { icon: "sparkles", value: `${events ?? 0}`, label: "link-ups" },
    { icon: "pin", value: "36", label: "states" },
  ];

  return (
    <div className="lg:grid lg:min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <aside
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#534AB7]/40 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#FAC775]/15 blur-[110px]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-8 -right-2 select-none text-[9rem] font-black uppercase leading-none tracking-tighter text-transparent" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.08)" }}>
          Welcome
        </span>

        <Link href="/" className="relative text-2xl font-extrabold tracking-tight">
          Link<span className="text-[#7F77DD]">Up</span>Naija
        </Link>

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FAC775]">
            Welcome back
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.1] tracking-tight">
            The vibe doesn&apos;t start till <span className="text-[#FAC775]">you pull up</span>.
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            Log back in to your parties, hangouts and the people you&apos;ve been
            linking up with.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {stats.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold backdrop-blur">
                <LineIcon name={s.icon} size={15} className="text-[#FAC775]" />
                <span className="tabular-nums">{s.value}</span>
                <span className="text-white/60">{s.label}</span>
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-lg font-bold text-[#AFA9EC]">
          Link up. Hang out. Vibe.
        </p>
      </aside>

      {/* Form side */}
      <div className="flex items-center justify-center px-4 py-12 sm:py-14">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div
            className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white lg:hidden"
            style={{ background: "linear-gradient(150deg, #1A1040 0%, #322C6E 100%)" }}
          >
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FAC775]/15 blur-[60px]" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FAC775]">
              Welcome back
            </p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight">
              The vibe doesn&apos;t start till <span className="text-[#FAC775]">you pull up</span>.
            </h1>
          </div>

          <div className="hidden text-center lg:block">
            <h1 className="text-3xl font-extrabold text-gray-900">Welcome back 👋</h1>
            <p className="mt-2 text-gray-600">Log in to join events and host your own.</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8 lg:mt-8">
            <Suspense fallback={null}>
              <AuthForm mode="login" />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
