"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import Avatar from "@/components/Avatar";
import LineIcon from "@/components/ui/LineIcon";

/**
 * Everyone who has signed up, and who brought them.
 *
 * There was no list. AdminHosts covers the 13 people who have posted an
 * event and AdminPro covers subscribers, so the other ~120 members existed
 * only as a count on the analytics page. "Who actually joined this week" was
 * not a question the admin could ask.
 *
 * REFERRALS FIRST, because Invite & earn pays real money and until
 * migration-admin-referrals.sql the referrals table could not be read by
 * anybody but the two people in each row. Rewards were being issued against a
 * ledger nobody could audit.
 *
 * The list is fetched whole rather than paginated. At 143 members that is one
 * small query, and a search box beats a pager for finding one person. Revisit
 * somewhere north of a couple of thousand.
 */

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  state: string | null;
  avatar_url: string | null;
  created_at: string;
  profile_completed: boolean | null;
  is_pro?: boolean | null;
}

interface Referral {
  referrer_id: string;
  status: string;
  reward_amount: number | null;
}

export default function AdminMembers() {
  const supabase = createClient();
  const [rows, setRows] = useState<Member[]>([]);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    // is_pro arrives with the Premium migration. Ask for it, and fall back to
    // the column set without it rather than losing the whole list.
    const FULL =
      "id, name, email, state, avatar_url, created_at, profile_completed, is_pro";
    const read = (cols: string) =>
      supabase
        .from("users")
        .select(cols)
        .order("created_at", { ascending: false });

    let res = await read(FULL);
    if (res.error) res = await read(FULL.replace(", is_pro", ""));
    if (res.error) toast.error(res.error.message);
    setRows((res.data ?? []) as unknown as Member[]);

    // Unreadable until the admin policy lands, and an empty leaderboard is a
    // truthful answer either way, so this failure stays quiet.
    const { data: r } = await supabase
      .from("referrals")
      .select("referrer_id, status, reward_amount");
    setRefs((r ?? []) as unknown as Referral[]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(
    () => new Map(rows.map((m) => [m.id, m])),
    [rows]
  );

  const leaders = useMemo(() => {
    const tally = new Map<string, { total: number; done: number; naira: number }>();
    for (const r of refs) {
      const t = tally.get(r.referrer_id) ?? { total: 0, done: 0, naira: 0 };
      t.total += 1;
      if (r.status === "completed") {
        t.done += 1;
        t.naira += r.reward_amount ?? 0;
      }
      tally.set(r.referrer_id, t);
    }
    return Array.from(tally.entries())
      .map(([id, t]) => ({ id, ...t, member: byId.get(id) }))
      .sort((a, b) => b.done - a.done || b.total - a.total)
      .slice(0, 10);
  }, [refs, byId]);

  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((m) =>
        [m.name, m.email, m.state]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : rows;

  const joinedThisWeek = rows.filter(
    (m) => Date.now() - new Date(m.created_at).getTime() < 7 * 86_400_000
  ).length;

  if (loading) return <p className="text-sm text-gray-500">Loading members…</p>;

  return (
    <div>
      {/* --- who brought people --- */}
      <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white">
        Top referrers
      </h3>
      {leaders.length === 0 ? (
        <p className="mt-1.5 rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-[13px] text-gray-500 dark:border-white/10">
          No referrals recorded. If that looks wrong, run
          supabase/migration-admin-referrals.sql: until it lands, this table is
          readable only by the two people named in each row, admins included.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {leaders.map((l, i) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 dark:border-white/10"
            >
              <span className="w-5 shrink-0 text-center text-[13px] font-black tabular-nums text-gray-400">
                {i + 1}
              </span>
              <Avatar
                name={l.member?.name ?? null}
                url={l.member?.avatar_url ?? null}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-gray-900 dark:text-white">
                {l.member?.name ?? "Unknown member"}
              </span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-gray-700 dark:text-white/70">
                {l.done}
                <span className="font-medium text-gray-400"> of {l.total}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* --- everyone --- */}
      <div className="mt-7 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white">
          All members
        </h3>
        <span className="shrink-0 text-[13px] text-gray-500">
          {rows.length} total · {joinedThisWeek} this week
        </span>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email or state"
        className="input mt-2"
      />

      <div className="mt-2 space-y-1.5">
        {shown.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 dark:border-white/10"
          >
            <Avatar name={m.name} url={m.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-gray-900 dark:text-white">
                <Link href={`/u/${m.id}`} target="_blank" className="truncate hover:underline">
                  {m.name ?? "No name"}
                </Link>
                {m.is_pro && (
                  <LineIcon name="star" size={12} filled className="shrink-0 text-[#FAC775]" />
                )}
              </p>
              <p className="truncate text-[12px] text-gray-500">{m.email}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-semibold text-gray-600 dark:text-white/60">
                {m.state ?? "No state"}
              </p>
              <p className="text-[11px] text-gray-400">
                {new Date(m.created_at).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                })}
                {!m.profile_completed && " · unfinished"}
              </p>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="px-1 py-4 text-sm text-gray-500">
            Nobody matches &ldquo;{q}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
