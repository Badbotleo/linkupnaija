/**
 * HOW WE TALK ABOUT SMALL NUMBERS — the single source of truth.
 *
 * A young platform tells the truth about itself on every card: "0 going",
 * "0 subscribers", "0/15 going", "✨ New host" on every host. Each one is
 * accurate and each one is a reason to leave. Twenty-four events all showing
 * zero doesn't read as twenty-four chances to go out; it reads as abandoned.
 *
 * The rule here is not to lie. We never inflate a number and we never invent
 * one. We just stay quiet until a number is worth saying, and say something
 * true but qualitative in the meantime ("Filling up" for 1–4 is true; it is
 * simply not a headcount).
 *
 * Everything that renders a count imports from here, so the thresholds can't
 * drift apart across the feed, the detail page and the carousels.
 */

/** Below this, we describe attendance instead of counting it. */
export const ATTENDANCE_REVEAL_AT = 5;
/** Below this, a circle's size is its own business. */
export const MEMBERS_REVEAL_AT = 10;
/** How long a brand-new event gets to say so. */
const JUST_LISTED_DAYS = 7;

export type ProofTone = "quiet" | "warm" | "urgent";

export interface AttendanceProof {
  /** What to render. */
  label: string;
  tone: ProofTone;
}

function isJustListed(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return false;
  return ms < JUST_LISTED_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The one function every attendee count goes through.
 *
 * - 0 going  → "Just listed" while the event is new, otherwise nothing at all.
 *              With a capacity we can still say how big it is ("15 spots"),
 *              which is useful and carries no signal about emptiness.
 * - 1–4      → "Filling up". True, and it doesn't hand out a headcount that
 *              would be better left unsaid.
 * - 5+       → the real number, which is now worth showing.
 *
 * Pass `past` for an event that has already happened and the whole ladder
 * switches tense: nothing, "Wrapped", or "12 went".
 *
 * Returns null when there is nothing honest and useful to say — callers must
 * render nothing in that case, not an empty pill.
 */
export function attendanceProof(
  count: number,
  opts: {
    capacity?: number | null;
    createdAt?: string | null;
    /** The event has already happened. Every label below is future tense. */
    past?: boolean;
  } = {}
): AttendanceProof | null {
  const { capacity, createdAt, past } = opts;
  const n = Math.max(0, Math.floor(count || 0));

  // A finished event cannot fill up, cannot have spots left, and is not
  // "just listed". Those labels were showing on the past tab and reading as a
  // pitch to attend something that ended weeks ago.
  //
  // Scarcity is dropped entirely rather than translated. "Was full" invites a
  // shrug; how many people came is the only part still worth knowing, and it
  // uses the same reveal threshold as everywhere else so a quiet night is
  // still not given a headcount.
  if (past) {
    if (n === 0) return null;
    if (n < ATTENDANCE_REVEAL_AT) return { label: "Wrapped", tone: "quiet" };
    return { label: `${n} went`, tone: "quiet" };
  }

  if (n === 0) {
    if (isJustListed(createdAt)) return { label: "Just listed", tone: "warm" };
    // No headcount, but the size of the room is a fact about the event itself.
    if (capacity && capacity > 0)
      return { label: `${capacity} spots`, tone: "quiet" };
    return null;
  }

  if (n < ATTENDANCE_REVEAL_AT) return { label: "Filling up", tone: "warm" };

  if (capacity && capacity > 0) {
    const left = capacity - n;
    // Scarcity is only meaningful once somebody has actually turned up, which
    // is guaranteed here — an empty event can never claim "3 spots left".
    if (left > 0 && left < ATTENDANCE_REVEAL_AT)
      return {
        label: `${left} spot${left === 1 ? "" : "s"} left`,
        tone: "urgent",
      };
    if (left <= 0) return { label: "Full", tone: "urgent" };
    return { label: `${n}/${capacity} going`, tone: "quiet" };
  }

  return { label: `${n} going`, tone: "quiet" };
}

/** Circle membership: silent under 10, plain fact at 10 and up. */
export function memberProof(count: number): string | null {
  const n = Math.max(0, Math.floor(count || 0));
  if (n < MEMBERS_REVEAL_AT) return null;
  return `${n} members`;
}

/** Series following: "0 subscribers" says nothing anyone needs to hear. */
export function subscriberProof(
  count: number,
  noun: "subscriber" | "follower" = "subscriber"
): string | null {
  const n = Math.max(0, Math.floor(count || 0));
  if (n < 1) return null;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
