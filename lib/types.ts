// Database row types for LinkUpNaija

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  state: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  phone: string | null;
  profile_completed: boolean;
  rating_avg: number;
  rating_count: number;
  is_admin: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  event_id: string | null;
  user_id: string | null;
  amount: number;
  platform_fee: number;
  paystack_reference: string | null;
  created_at: string;
}

// Subset of profile fields shown on profile cards (dashboard, requests).
export type PublicProfile = Pick<
  UserProfile,
  | "id"
  | "name"
  | "state"
  | "avatar_url"
  | "bio"
  | "instagram_url"
  | "twitter_url"
  | "facebook_url"
>;

export type RsvpStatus = "pending" | "accepted" | "declined";

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
  cover_image_url: string | null;
  price: number;
  featured: boolean;
  featured_until: string | null;
  created_at: string;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  payment_reference: string | null;
  paid: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  message: string;
  event_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  event_id: string;
  reviewer_id: string;
  host_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

// A review joined with the reviewer's display info (for the UI).
export interface ReviewWithReviewer extends Review {
  reviewer: { name: string | null; avatar_url: string | null } | null;
}

// An RSVP row joined with the requester's public profile (host management).
export interface RsvpWithProfile {
  id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  users: PublicProfile | null;
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
