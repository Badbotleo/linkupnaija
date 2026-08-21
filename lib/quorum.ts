/**
 * "Nobody goes alone" — joining is conditional on other people joining.
 *
 * The median room on this platform has one person in it. Asking a stranger to
 * be that one person is asking them to take the whole social risk themselves,
 * and the numbers say almost nobody accepts. A quorum moves that risk off the
 * individual: you're in if enough others are, and if the room never fills it
 * quietly doesn't happen and nobody was the person who turned up alone.
 *
 * Deliberately optional. An event with no minimum behaves exactly as before —
 * this is a mode a host chooses, not a rule imposed on every listing.
 */

export type QuorumState =
  /** No minimum set. Ordinary event. */
  | { kind: "none" }
  /** Still gathering. */
  | { kind: "pending"; going: number; need: number; toGo: number }
  /** Enough people. This is sticky — see below. */
  | { kind: "met"; going: number; need: number; paid: boolean }
  /** The date arrived and it never filled. */
  | { kind: "failed"; going: number; need: number };

export interface QuorumInput {
  minAttendees: number | null | undefined;
  /**
   * Ticket price. A paid quorum event collects nothing until the room fills —
   * guests reserve for free and are asked to pay only once it's confirmed, so
   * no refund is ever required because no money moves for an event that
   * doesn't happen.
   */
  price?: number | null;
  going: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Set once the threshold was first reached; makes "met" permanent. */
  quorumMetAt?: string | null;
  /** Injectable so this stays testable and deterministic. */
  today?: string;
}

export function quorumState({
  minAttendees,
  going,
  date,
  quorumMetAt,
  price,
  today = new Date().toISOString().slice(0, 10),
}: QuorumInput): QuorumState {
  // A minimum of 1 is the same as no minimum — one person is not a room, and
  // showing "1 to go" on every empty event would be noise dressed as a
  // mechanic.
  if (!minAttendees || minAttendees <= 1) return { kind: "none" };

  // Sticky on purpose. Once a room has filled, the plan is real and people
  // have arranged their evening around it; a single person dropping out must
  // not un-confirm everyone else. quorum_met_at is the record that it
  // happened, and it is never cleared.
  if (quorumMetAt || going >= minAttendees) {
    return { kind: "met", going, need: minAttendees, paid: (price ?? 0) > 0 };
  }

  if (date < today) return { kind: "failed", going, need: minAttendees };

  return {
    kind: "pending",
    going,
    need: minAttendees,
    toGo: minAttendees - going,
  };
}

/**
 * The line a stranger reads.
 *
 * Never says "0 going" and never says "be the first" — the whole point is
 * that being first costs nothing here, so the copy leads with what happens
 * next rather than with how empty it is.
 */
export function quorumLabel(s: QuorumState): string | null {
  switch (s.kind) {
    case "none":
      return null;
    case "met":
      // On a paid event "it's on" is only half the news; the other half is
      // that money is now due, and burying that produces expired
      // reservations and people who thought they had a ticket.
      return s.paid
        ? "It's on — your spot is held, pay to confirm"
        : "Happening — the room filled";
    case "failed":
      return "This one didn't fill";
    case "pending":
      return s.toGo === 1
        ? "1 more person and it's on"
        : `${s.toGo} more and it's on`;
  }
}

/** Progress for the bar, clamped so a full room can't overflow it. */
export function quorumProgress(s: QuorumState): number {
  if (s.kind === "none") return 0;
  if (s.kind === "met") return 1;
  return Math.max(0, Math.min(1, s.going / s.need));
}
