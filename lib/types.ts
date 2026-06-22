// Database row types for LinkUpNaija

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  state: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  category: string;
  description: string;
  date: string; // ISO date (YYYY-MM-DD)
  time: string; // HH:MM:SS
  location: string;
  state: string;
  host_id: string;
  max_attendees: number | null;
  created_at: string;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
}

// Event with a joined attendee count, as returned by the events feed query.
export interface EventWithCount extends EventRow {
  rsvps: { count: number }[];
}

// Event joined with its host profile (used on the detail page).
export interface EventWithHost extends EventRow {
  host: Pick<UserProfile, "id" | "name" | "avatar_url" | "state"> | null;
}

export interface ChatMessageRow {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

// A chat message resolved with its sender's display name (for the UI).
export interface ChatMessageUI {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  senderName: string;
}
