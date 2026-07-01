import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/notifications");

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []) as AppNotification[];

  // Mark everything read on view.
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return (
    <div className="container-page max-w-2xl py-6">
      <h1 className="text-2xl font-extrabold text-gray-900">Notifications</h1>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <p className="text-4xl">🔔</p>
          <p className="mt-3 font-semibold text-gray-900">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-gray-500">
            New activity from your events and friends shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((n) => {
            const body = (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
                  n.read ? "border-gray-100 bg-white" : "border-brand/20 bg-brand-50/40"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-lg">
                  🔔
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{n.message}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.event_id ? (
                  <Link href={`/events/${n.event_id}`}>{body}</Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
