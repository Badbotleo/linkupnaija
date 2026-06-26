"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CategoryBadge from "@/components/CategoryBadge";
import { formatEventDate } from "@/lib/format";

interface ExpiredEvent {
  id: string;
  title: string;
  category: string;
  state: string;
  date: string;
}

export default function AdminExpiredEvents({
  initialEvents,
}: {
  initialEvents: ExpiredEvent[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [events, setEvents] = useState(initialEvents);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Permanently delete this expired event?")) return;
    setBusyId(id);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    }
    setBusyId(null);
  }

  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
        No expired events.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <ul className="divide-y divide-gray-50">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <Link
                href={`/events/${e.id}`}
                className="truncate font-semibold text-gray-900 hover:text-brand"
              >
                {e.title}
              </Link>
              <div className="mt-1 flex items-center gap-2">
                <CategoryBadge category={e.category} />
                <span className="text-xs text-gray-400">
                  {e.state} · {formatEventDate(e.date)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(e.id)}
              disabled={busyId === e.id}
              className="btn shrink-0 border border-red-200 bg-white py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              {busyId === e.id ? "…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
