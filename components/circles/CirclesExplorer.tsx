"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import EventCover from "../EventCover";
import CircleArt from "./CircleArt";
import LineIcon from "../ui/LineIcon";
import Avatar from "../Avatar";
import { memberProof } from "@/lib/social-proof";
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
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  /**
   * Posts in the last week, per circle.
   *
   * A cover image and a member count cannot tell a living community from a
   * dead one, and every card looked identical because that is all they
   * carried. This is one extra query and it is the difference between "42
   * members" and "42 members, 9 posts this week".
   */
  const [activity, setActivity] = useState<Map<string, { posts: number; last: string }>>(new Map());
  /**
   * A few faces from each circle.
   *
   * This page had not one person on it. A circle is people, and the card
   * showed a cover photo, a name and a Join button, which is the anatomy of a
   * product listing. Facebook Groups and X Communities both lead with members
   * for the same reason: three faces answer "is there anybody in here" faster
   * than any number does.
   */
  const [faces, setFaces] = useState<Map<string, { name: string | null; avatar_url: string | null }[]>>(new Map());

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
    const rows = (circleRows ?? []) as Circle[];
    setCircles(rows);
    const m = new Map<string, "active" | "pending">();
    for (const row of (memRes.data ?? []) as { circle_id: string; status: "active" | "pending" }[]) {
      m.set(row.circle_id, row.status);
    }
    setMemberships(m);
    setLoading(false);

    // Supporting content: if this fails the cards simply say less. It must
    // never be the reason the page does not render.
    if (rows.length > 0) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: posts } = await supabase
        .from("circle_posts")
        .select("circle_id, created_at")
        .in("circle_id", rows.map((c) => c.id))
        .gte("created_at", weekAgo);
      const a = new Map<string, { posts: number; last: string }>();
      for (const p of (posts ?? []) as { circle_id: string; created_at: string }[]) {
        const cur = a.get(p.circle_id);
        if (!cur) a.set(p.circle_id, { posts: 1, last: p.created_at });
        else {
          cur.posts += 1;
          if (p.created_at > cur.last) cur.last = p.created_at;
        }
      }
      setActivity(a);

      // Capped rather than per-circle limited: one round trip beats eighty,
      // and only the first few of each are ever drawn.
      const { data: members } = await supabase
        .from("circle_members")
        .select("circle_id, users(name, avatar_url)")
        .in("circle_id", rows.map((c) => c.id))
        .eq("status", "active")
        .limit(600);
      const f = new Map<string, { name: string | null; avatar_url: string | null }[]>();
      for (const m of (members ?? []) as unknown as {
        circle_id: string;
        users: { name: string | null; avatar_url: string | null } | null;
      }[]) {
        if (!m.users) continue;
        const list = f.get(m.circle_id) ?? [];
        if (list.length < 4) {
          list.push(m.users);
          f.set(m.circle_id, list);
        }
      }
      setFaces(f);
    }
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
      toast.success(circle.is_private ? "Request sent" : "Joined");
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

  /**
   * Three shelves, and every circle appears on at most one of them.
   *
   * "Circles near you", "Popular circles" and "New circles" were built by
   * slicing the same array three ways, so with a small catalogue all three
   * showed the same six cards. Scrolling past the same community three times
   * does not read as choice, it reads as a page with nothing in it. The
   * events page had exactly this bug and it was fixed there.
   *
   * Yours leads, because a circle you have already joined is the one you came
   * back for.
   */
  const score = (c: Circle) =>
    (activity.get(c.id)?.posts ?? 0) * 10 + c.member_count;

  const mine = circles.filter((c) => memberships.get(c.id) === "active");
  const taken = new Set(mine.map((c) => c.id));

  const nearYou = myState
    ? circles.filter((c) => !taken.has(c.id) && c.state === myState).sort((a, b) => score(b) - score(a)).slice(0, 6)
    : [];
  nearYou.forEach((c) => taken.add(c.id));

  const rest = circles.filter((c) => !taken.has(c.id)).sort((a, b) => score(b) - score(a));

  const card = (c: Circle) => (
    <Card
      key={c.id}
      circle={c}
      activity={activity.get(c.id)}
      faces={faces.get(c.id) ?? []}
      status={memberships.get(c.id)}
      busy={busyId === c.id}
      canJoin={!!meId}
      onJoin={() => join(c)}
    />
  );

  return (
    <div>
      {/* Two dropdowns is a web form. Everywhere else in this app you filter
          by swiping a row of chips — events, vendors, the vibe picker — and a
          native <select> on a phone throws you into a full-screen wheel to
          choose one of ninety-seven things. */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search circles"
        className="input w-full"
      />

      {/* Two long chip rows, 54 categories and 37 states, sat above the first
          circle anybody saw. Filters are for narrowing something you are
          already looking at. */}
      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
        className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-bold text-gray-700 transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:bg-transparent dark:text-white/80"
      >
        <LineIcon name="search" size={15} className="text-gray-400" />
        {category || state ? `${[category, state].filter(Boolean).join(" · ")}` : "Filter by vibe or state"}
        <LineIcon
          name="chevronRight"
          size={14}
          className={`ml-auto shrink-0 text-gray-400 transition ${showFilters ? "rotate-90" : ""}`}
        />
      </button>

      {showFilters && (
        <>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip on={!category} onClick={() => setCategory("")}>
          All
        </Chip>
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip on={!state} onClick={() => setState("")}>
          Anywhere
        </Chip>
        {NIGERIAN_STATES.map((s) => (
          <Chip key={s} on={state === s} onClick={() => setState(s)}>
            {s}
          </Chip>
        ))}
      </div>
        </>
      )}

      {loading ? (
        /* Card-shaped, so the page does not jump when the real ones land.
           Without this the "No circles yet" empty state showed first and
           told everybody the platform had no communities on it. */
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden surface">
              <div className="h-28 w-full animate-pulse bg-gray-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtering ? (
        <Section title={`${filtered.length} result${filtered.length === 1 ? "" : "s"}`}>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No circles match. Try a different search.</p>
          ) : (
            <Grid>{filtered.map(card)}</Grid>
          )}
        </Section>
      ) : circles.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand">
            <LineIcon name="circles" size={24} />
          </span>
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            No circles yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Be the first to start a community around what you love.
          </p>
          <Link href="/circles/create" className="btn-primary mt-5">
            Create a circle
          </Link>
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <Section
              title="Your circles"
              hint="The rooms you are already in"
            >
              <Grid>{mine.map(card)}</Grid>
            </Section>
          )}
          {nearYou.length > 0 && (
            <Section
              title={`In ${myState}`}
              hint="Close enough to actually turn up"
            >
              <Grid>{nearYou.map(card)}</Grid>
            </Section>
          )}
          {rest.length > 0 && (
            <Section
              title={mine.length > 0 || nearYou.length > 0 ? "More to join" : "Circles"}
              hint="Busiest first"
            >
              <Grid>{rest.map(card)}</Grid>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-[-0.01em] text-gray-900 dark:text-white">
        {title}
      </h2>
      {hint && <p className="mb-3 mt-0.5 text-[13px] text-gray-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** "Active today", "9 posts this week", or nothing rather than a lie. */
function pulse(a?: { posts: number; last: string }): string | null {
  if (!a || a.posts === 0) return null;
  const hours = (Date.now() - new Date(a.last).getTime()) / 3600000;
  if (hours < 24) return "Active today";
  if (hours < 72) return "Active this week";
  return `${a.posts} post${a.posts === 1 ? "" : "s"} this week`;
}

function Card({
  circle,
  status,
  activity,
  faces,
  busy,
  canJoin,
  onJoin,
}: {
  circle: Circle;
  status?: "active" | "pending";
  activity?: { posts: number; last: string };
  faces: { name: string | null; avatar_url: string | null }[];
  busy: boolean;
  canJoin: boolean;
  onJoin: () => void;
}) {
  const live = pulse(activity);
  return (
    <div className="flex flex-col overflow-hidden surface">
      <Link href={`/circles/${circle.id}`} className="block">
        {circle.cover_image_url ? (
          <EventCover
            url={circle.cover_image_url}
            category={circle.category ?? "Networking"}
            title={circle.name}
            className="h-28 w-full"
          />
        ) : (
          <CircleArt name={circle.name} members={circle.member_count} className="h-28 w-full" />
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/circles/${circle.id}`} className="font-bold text-gray-900 hover:text-brand">
          {circle.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-500">
          {[circle.category, circle.state].filter(Boolean).join(" · ")}
          {circle.is_private ? " · Private" : ""}
        </p>
        {circle.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{circle.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            {faces.length > 0 ? (
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  {faces.map((f, i) => (
                    <span
                      key={i}
                      className="rounded-full ring-2 ring-white dark:ring-[#121212]"
                    >
                      <Avatar name={f.name} url={f.avatar_url} size="xs" />
                    </span>
                  ))}
                </span>
                <span className="truncate text-xs font-semibold text-gray-500">
                  {memberProof(circle.member_count) ??
                    `${circle.member_count} member${circle.member_count === 1 ? "" : "s"}`}
                </span>
              </span>
            ) : (
              memberProof(circle.member_count) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                  <LineIcon name="users" size={13} className="text-gray-400" />
                  {memberProof(circle.member_count)}
                </span>
              )
            )}
            {/* The one line that separates a community from a listing. A
                green dot next to "Active today" is the whole reason to tap
                this card rather than the one below it. */}
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-naija-600">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-naija"
                  aria-hidden
                />
                {live}
              </span>
            )}
          </span>
          {/* "Joined" was a full stop. Somebody who has joined a circle wants
              to be in it, and the card gave them a tick and no way through.
              The button becomes the door. */}
          {status === "active" ? (
            <Link
              href={`/circles/${circle.id}`}
              className="btn-primary shrink-0 px-3 py-1.5 text-sm"
            >
              Open
            </Link>
          ) : status === "pending" ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-500 dark:bg-white/10 dark:text-white/60">
              Requested
            </span>
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

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        on
          ? "bg-brand text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
