"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import Avatar from "../Avatar";
import MessageButton from "../MessageButton";
import type { FriendUser } from "@/lib/types";

interface Relation {
  status: "pending" | "accepted" | "declined";
  direction: "in" | "out";
  connId: string;
}

interface ConnRow {
  id: string;
  status: Relation["status"];
  requester_id: string;
  receiver_id: string;
  requester: FriendUser | null;
  receiver: FriendUser | null;
}

const CONN_SELECT =
  "id, status, requester_id, receiver_id, " +
  "requester:users!connections_requester_id_fkey(id, name, avatar_url, state), " +
  "receiver:users!connections_receiver_id_fkey(id, name, avatar_url, state)";

export default function FriendsManager({
  meId,
  myState,
}: {
  meId: string;
  myState: string | null;
}) {
  const supabase = createClient();

  const [relations, setRelations] = useState<Map<string, Relation>>(new Map());
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<{ connId: string; user: FriendUser }[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    const { data } = await supabase
      .from("connections")
      .select(CONN_SELECT)
      .or(`requester_id.eq.${meId},receiver_id.eq.${meId}`);

    const rows = (data ?? []) as unknown as ConnRow[];
    const rel = new Map<string, Relation>();
    const fr: FriendUser[] = [];
    const inc: { connId: string; user: FriendUser }[] = [];

    for (const r of rows) {
      const iAmRequester = r.requester_id === meId;
      const other = iAmRequester ? r.receiver : r.requester;
      if (!other) continue;
      rel.set(other.id, {
        status: r.status,
        direction: iAmRequester ? "out" : "in",
        connId: r.id,
      });
      if (r.status === "accepted") fr.push(other);
      else if (r.status === "pending" && !iAmRequester)
        inc.push({ connId: r.id, user: other });
    }
    setRelations(rel);
    setFriends(fr);
    setIncoming(inc);
    return rel;
  }, [meId, supabase]);

  const loadSuggestions = useCallback(
    async (rel: Map<string, Relation>) => {
      if (!myState) {
        setSuggestions([]);
        return;
      }
      // "People you might know" — same-state members, excluding me + anyone
      // already connected/requested. Random offset gives variety on refresh.
      const { count } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("state", myState)
        .neq("id", meId);
      const total = count ?? 0;
      const offset = total > 30 ? Math.floor(Math.random() * (total - 30)) : 0;

      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, state")
        .eq("state", myState)
        .neq("id", meId)
        .order("created_at", { ascending: false })
        .range(offset, offset + 29);

      const candidates = (data ?? []) as FriendUser[];
      setSuggestions(candidates.filter((u) => !rel.has(u.id)).slice(0, 6));
    },
    [meId, myState, supabase]
  );

  const refresh = useCallback(async () => {
    const rel = await loadConnections();
    await loadSuggestions(rel);
  }, [loadConnections, loadSuggestions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced search by name or email.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, state")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .neq("id", meId)
        .limit(12);
      setResults((data ?? []) as FriendUser[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, meId, supabase]);

  async function sendRequest(userId: string) {
    setBusyId(userId);
    const { error } = await supabase
      .from("connections")
      .insert({ requester_id: meId, receiver_id: userId, status: "pending" });
    if (error) toast.error("Couldn't send request. You may already be connected.");
    else {
      toast.success("Friend request sent 👋");
      await loadConnections();
    }
    setBusyId(null);
  }

  async function respond(connId: string, status: "accepted" | "declined") {
    setBusyId(connId);
    const { error } = await supabase
      .from("connections")
      .update({ status })
      .eq("id", connId);
    if (error) toast.error("Something went wrong.");
    else {
      toast.success(status === "accepted" ? "You're now friends 🤝" : "Request declined");
      await refresh();
    }
    setBusyId(null);
  }

  function ActionButton({ user }: { user: FriendUser }) {
    const rel = relations.get(user.id);
    if (rel?.status === "accepted")
      return <span className="text-sm font-semibold text-green-600">✓ Friends</span>;
    if (rel?.status === "pending" && rel.direction === "out")
      return <span className="text-sm font-medium text-gray-400">Requested</span>;
    if (rel?.status === "pending" && rel.direction === "in")
      return (
        <button
          type="button"
          disabled={busyId === rel.connId}
          onClick={() => respond(rel.connId, "accepted")}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          Accept
        </button>
      );
    return (
      <button
        type="button"
        disabled={busyId === user.id}
        onClick={() => sendRequest(user.id)}
        className="btn-outline px-3 py-1.5 text-sm"
      >
        {busyId === user.id ? "…" : "Add friend"}
      </button>
    );
  }

  return (
    <div className="space-y-10">
      {/* Search */}
      <section>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or email…"
          className="input"
          aria-label="Search people"
        />
        {results !== null && (
          <div className="mt-4">
            {searching ? (
              <p className="text-sm text-gray-400">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-500">No people found.</p>
            ) : (
              <ul className="space-y-2">
                {results.map((u) => (
                  <Row key={u.id} user={u} action={<ActionButton user={u} />} />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Incoming requests */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Friend requests
          {incoming.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {incoming.length}
            </span>
          )}
        </h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map(({ connId, user }) => (
              <Row
                key={connId}
                user={user}
                action={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === connId}
                      onClick={() => respond(connId, "accepted")}
                      className="btn-primary px-3 py-1.5 text-sm"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId === connId}
                      onClick={() => respond(connId, "declined")}
                      className="btn border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      Decline
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Friends */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          Your friends
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
            {friends.length}
          </span>
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-500">
            No friends yet — search above to connect with people.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {friends.map((u) => (
              <Row
                key={u.id}
                user={u}
                action={
                  <MessageButton
                    meId={meId}
                    targetId={u.id}
                    targetName={u.name}
                    targetAvatar={u.avatar_url}
                    label="Message"
                    className="btn-outline px-3 py-1.5 text-sm"
                  />
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Suggestions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">People you might know</h2>
          <button
            type="button"
            onClick={() => loadSuggestions(relations)}
            className="text-sm font-semibold text-brand hover:underline"
          >
            ↻ Refresh
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No suggestions right now. Check back later!
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((u) => (
              <Row key={u.id} user={u} action={<ActionButton user={u} />} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({
  user,
  action,
}: {
  user: FriendUser;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <Link
        href={`/u/${user.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar name={user.name} url={user.avatar_url} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 hover:text-brand">
            {user.name ?? "LinkUpNaija member"}
          </p>
          {user.state && (
            <p className="truncate text-xs text-gray-500">📍 {user.state}</p>
          )}
        </div>
      </Link>
      {action}
    </li>
  );
}
