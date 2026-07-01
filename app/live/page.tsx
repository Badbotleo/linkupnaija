import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live" };

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Item {
  key: string;
  time: string;
  icon: string;
  text: string;
  href: string;
}

export default async function LivePage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: events }, { data: rsvps }, { data: posts }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, created_at, host:users!events_host_id_fkey(name)")
      .eq("event_type", "general")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("rsvps")
      .select("id, created_at, status, users(name), events(id, title, event_type, date)")
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("circle_posts")
      .select("id, created_at, users:users!circle_posts_user_id_fkey(name), circles(id, name, is_private)")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const items: Item[] = [];

  for (const e of (events ?? []) as unknown as {
    id: string;
    title: string;
    created_at: string;
    host: { name: string | null } | null;
  }[]) {
    items.push({
      key: `e-${e.id}`,
      time: e.created_at,
      icon: "🎉",
      text: `${e.host?.name ?? "A host"} is hosting ${e.title}`,
      href: `/events/${e.id}`,
    });
  }

  for (const r of (rsvps ?? []) as unknown as {
    id: string;
    created_at: string;
    users: { name: string | null } | null;
    events: { id: string; title: string; event_type: string; date: string } | null;
  }[]) {
    if (!r.events || r.events.event_type !== "general") continue;
    items.push({
      key: `r-${r.id}`,
      time: r.created_at,
      icon: r.events.date >= today ? "🙌" : "✅",
      text: `${r.users?.name ?? "Someone"} is going to ${r.events.title}`,
      href: `/events/${r.events.id}`,
    });
  }

  for (const p of (posts ?? []) as unknown as {
    id: string;
    created_at: string;
    users: { name: string | null } | null;
    circles: { id: string; name: string; is_private: boolean } | null;
  }[]) {
    if (!p.circles || p.circles.is_private) continue;
    items.push({
      key: `p-${p.id}`,
      time: p.created_at,
      icon: "💬",
      text: `${p.users?.name ?? "Someone"} posted in ${p.circles.name}`,
      href: `/circles/${p.circles.id}`,
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="container-page max-w-2xl py-6">
      <div className="flex items-center gap-2">
        <span className="relative grid h-3 w-3 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-red-500" />
        </span>
        <h1 className="text-2xl font-extrabold text-gray-900">Live feed</h1>
      </div>
      <p className="mt-1 text-gray-600">See what&apos;s happening across LinkUpNaija right now.</p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-500">
          Nothing happening yet — be the first to host or join an event!
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.slice(0, 40).map((i) => (
            <li key={i.key}>
              <Link
                href={i.href}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm transition hover:border-brand/30"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-lg">
                  {i.icon}
                </span>
                <span className="min-w-0 flex-1 text-sm text-gray-800">{i.text}</span>
                <span className="shrink-0 text-xs text-gray-400">{ago(i.time)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
