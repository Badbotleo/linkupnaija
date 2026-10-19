"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/paystack";
import { toast } from "@/lib/toast";
import LineIcon from "@/components/ui/LineIcon";

type Member = { id: string; name: string | null; email: string };

/**
 * Credit a member's wallet.
 *
 * THE PICKER USED TO BE A NATIVE SELECT holding every member on the
 * platform, which meant the only way to find somebody was to scroll a list
 * that grows with the user base, in alphabetical-by-nothing order, with no
 * way to type. It was workable at fifty members and is not at a thousand.
 * Worse, a native select gives no feedback on the way: scroll past the right
 * name and you credit the wrong person's wallet with real money.
 *
 * So: type to filter on name or email, and a chosen member stays on screen
 * as a confirmed row rather than collapsing back into a box of text. The
 * amount field stays disabled until somebody is actually selected, because
 * the failure worth designing against here is a correct amount sent to the
 * wrong account.
 *
 * THE SEARCH HITS THE DATABASE, not the prop. The page hands this component
 * the 200 most recently joined members, which is the right size for a list
 * you scroll and the wrong one for a search: filtering it client-side would
 * answer "nobody matches" for every member who joined before those 200, and
 * answer it just as confidently. Those are exactly the long-standing
 * accounts most likely to be owed something.
 */
export default function AdminWalletCredit({ users }: { users: Member[] }) {
  const supabase = createClient();
  const [picked, setPicked] = useState<Member | null>(null);
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const [matches, setMatches] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const needle = q.trim();
    if (!needle) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    // Debounced, so typing a name is one query rather than one per letter.
    const t = setTimeout(async () => {
      // The local list first: it covers the recent members instantly and
      // means the dropdown is never empty while the query is in flight.
      const low = needle.toLowerCase();
      const local = users.filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(low) ||
          u.email.toLowerCase().includes(low)
      );

      // PostgREST `or` takes a comma-separated filter list, and a comma or a
      // parenthesis inside the search text would be read as part of that
      // syntax rather than as something to match. Stripped, not escaped:
      // there is no sensible name or address containing them.
      const safe = needle.replace(/[,()*]/g, " ").trim();
      let remote: Member[] = [];
      if (safe) {
        const { data } = await supabase
          .from("users")
          .select("id, name, email")
          .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
          .limit(8);
        remote = (data ?? []) as Member[];
      }

      // Merge, local first, de-duplicated by id. Capped at eight: a list
      // longer than the screen is the scrolling problem again.
      const seen = new Set<string>();
      const merged: Member[] = [];
      for (const u of [...local, ...remote]) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        merged.push(u);
        if (merged.length === 8) break;
      }
      setMatches(merged);
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
    // `supabase` is a fresh client object on every render, so including it
    // here would re-run this effect forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, users]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.floor(Number(amount));
    if (!picked || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Pick a member and a valid amount.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_credit_wallet", {
      p_user: picked.id,
      p_amount: amt,
      p_reason: reason.trim() || "Admin credit",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Credited ${formatNaira(amt)} to ${picked.name ?? picked.email}`
    );
    // The member is cleared too. Leaving them selected after a successful
    // credit is how the same person gets paid twice.
    setPicked(null);
    setQ("");
    setAmount("");
    setReason("");
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-card">
      <span className="label">Member</span>

      {picked ? (
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-50/50 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white">
            <LineIcon name="check" size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-gray-900">
              {picked.name ?? "Unnamed"}
            </span>
            <span className="block truncate text-xs text-gray-500">
              {picked.email}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setQ("");
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-white hover:text-brand"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative mt-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            autoComplete="off"
            className="input"
          />
          {q.trim() && (
            <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-sm text-gray-500">
                  {/* "Searching" and "nobody" are different answers, and
                      showing the second while the first is true is how an
                      admin concludes a member does not exist. */}
                  {searching
                    ? "Searching…"
                    : `Nobody matches “${q.trim()}”.`}
                </li>
              ) : (
                matches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(u);
                        // Straight to the amount, so the whole thing is one
                        // run from the keyboard.
                        setTimeout(() => amountRef.current?.focus(), 0);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">
                          {u.name ?? "Unnamed"}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {u.email}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Amount (₦)</span>
          <input
            ref={amountRef}
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            disabled={!picked}
            className="input disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="label">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Compensation for cancelled event"
            disabled={!picked}
            className="input disabled:opacity-50"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy || !picked || !amount}
        className="btn-primary mt-4 disabled:opacity-50"
      >
        {busy
          ? "Crediting…"
          : picked && amount
            ? `Credit ${formatNaira(Math.floor(Number(amount)) || 0)} to ${
                (picked.name ?? picked.email).split(" ")[0]
              }`
            : "Credit wallet"}
      </button>
    </form>
  );
}
