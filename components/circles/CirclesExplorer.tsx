"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import EventCover from "../EventCover";
import type { Circle } from "@/lib/types";

export default function CirclesExplorer({
  meId,
  myState,
}: {
  meId: string | null;
  myState: string | null;
}) {
  const supabase = createClient();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [memberships, setMemberships] = useState<Map<string, "active" | "pending">>(new Map());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: circleRows }, memRes] = await Promise.all([
      supabase
        .from("circles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      meId
        ? supabase.from("circle_members").select("circle_id, status").eq("user_id", meId)
        : Promise.resolve({ data: [] }),
    ]);
    setCircles((circleRows ?? []) as Circle[]);
    const m = new Map<string, "active" | "pending">();
    for (const row of (memRes.data ?? []) as { circle_id: string; status: "active" | "pending" }[]) {
      m.set(row.circle_id, row.status);
    }
    setMemberships(m);
  }, [meId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function join(circle: Circle) {
    if (!meId) return;
    setBusyId(circle.id);
    const status = circle.is_private ? "pending" : "active";
    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: circle.id, user_id: meId, status });
    if (error) toast.error("Couldn't join. Try again.");
    else {
      setMemberships((prev) => new Map(prev).set(circle.id, status));
      toast.success(circle.is_private ? "Request sent 🔔" : "Joined 🎉");
    }
    setBusyId(null);
  }

  const term = query.trim().toLowerCase();
  const filtering = !!term || !!category || !!state;
  const matches = (c: Circle) =>
    (!term || c.name.toLowerCase().includes(term)) &&
    (!category || c.category === category) &&
    (!state || c.state === state);

  const filtered = circles.filter(matches);
  const popular = [...circles].sort((a, b) => b.member_count - a.member_count).slice(0, 6);
  const fresh = circles.slice(0, 6);
  const nearYou = myState ? circles.filter((c) => c.state === myState).slice(0, 6) : [];

  const card = (c: Circle) => (
    <Card
      key={c.id}
      circle={c}
      status={memberships.get(c.id)}
      busy={busyId === c.id}
      canJoin={!!meId}
      onJoin={() => join(c)}
    />
  );

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search circles by name…"
          className="input flex-1"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input cursor-pointer sm:max-w-[10rem]">
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="input cursor-pointer sm:max-w-[10rem]">
          <option value="">All states</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtering ? (
        <Section title={`${filtered.length} result${filtered.length === 1 ? "" : "s"}`}>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No circles match. Try a different search.</p>
          ) : (
            <Grid>{filtered.map(card)}</Grid>
          )}
        </Section>
      ) : (
        <>
          {nearYou.length > 0 && (
            <Section title="📍 Circles near you">
              <Grid>{nearYou.map(card)}</Grid>
            </Section>
          )}
          <Section title="🔥 Popular circles">
            <Grid>{popular.map(card)}</Grid>
          </Section>
          <Section title="✨ New circles">
            <Grid>{fresh.map(card)}</Grid>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Card({
  circle,
  status,
  busy,
  canJoin,
  onJoin,
}: {
  circle: Circle;
  status?: "active" | "pending";
  busy: boolean;
  canJoin: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <Link href={`/circles/${circle.id}`} className="block">
        <EventCover
          url={circle.cover_image_url}
          category={circle.category ?? "Networking"}
          title={circle.name}
          className="h-28 w-full"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/circles/${circle.id}`} className="font-bold text-gray-900 hover:text-brand">
          {circle.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-500">
          {[circle.category, circle.state].filter(Boolean).join(" · ")}
          {circle.is_private ? " · 🔒 Private" : ""}
        </p>
        {circle.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{circle.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">
            👥 {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
          </span>
          {status === "active" ? (
            <span className="text-sm font-semibold text-green-600">✓ Joined</span>
          ) : status === "pending" ? (
            <span className="text-sm font-medium text-gray-400">Requested</span>
          ) : canJoin ? (
            <button type="button" onClick={onJoin} disabled={busy} className="btn-primary px-3 py-1.5 text-sm">
              {busy ? "…" : circle.is_private ? "Request" : "Join"}
            </button>
          ) : (
            <Link href={`/login?redirect=/circles/${circle.id}`} className="btn-outline px-3 py-1.5 text-sm">
              Join
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
