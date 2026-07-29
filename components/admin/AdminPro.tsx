"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isProActive } from "@/lib/pro";
import { toast } from "@/lib/toast";
import Avatar from "@/components/Avatar";
import ProBadge from "@/components/ProBadge";
import LineIcon from "@/components/ui/LineIcon";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  is_pro: boolean | null;
  pro_expires_at: string | null;
}

const TERMS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 12, label: "1 year" },
];

export default function AdminPro() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, avatar_url, is_pro, pro_expires_at")
      .order("is_pro", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pros = users.filter((u) => isProActive(u.is_pro, u.pro_expires_at));
    if (!q) return pros; // with no search, show who's already Pro
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  async function setPro(u: UserRow, m: number) {
    setBusyId(u.id);
    const { error } = await supabase.rpc("admin_set_pro", {
      p_user: u.id,
      p_months: m,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        m > 0
          ? `${u.name ?? u.email} is Pro for ${m} month${m === 1 ? "" : "s"}`
          : `Pro removed from ${u.name ?? u.email}`
      );
      await load();
    }
    setBusyId(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="space-y-3 border-b border-gray-100 p-4">
        <div className="relative">
          <LineIcon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any user by name or email to grant Pro…"
            className="input w-full rounded-full pl-10"
            aria-label="Search users"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Grant for
          </span>
          {TERMS.map((t) => (
            <button
              key={t.months}
              type="button"
              onClick={() => setMonths(t.months)}
              aria-pressed={months === t.months}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                months === t.months
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Loading users…</p>
      ) : shown.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">
          {query.trim()
            ? `No user matched “${query.trim()}”.`
            : "Nobody has Pro yet. Search above to grant it."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {shown.map((u) => {
            const pro = isProActive(u.is_pro, u.pro_expires_at);
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.name} url={u.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-gray-900">
                    <span className="truncate">{u.name ?? "Member"}</span>
                    {pro && <ProBadge size={14} />}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {u.email}
                    {pro && u.pro_expires_at
                      ? ` · until ${new Date(u.pro_expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => setPro(u, months)}
                    className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {pro ? "Extend" : "Make Pro"}
                  </button>
                  {pro && (
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => setPro(u, 0)}
                      className="btn border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
