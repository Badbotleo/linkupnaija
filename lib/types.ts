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
  is_pro: boolean;
  pro_expires_at: string | null;
  gender: "male" | "female" | "prefer not to say" | null;
  payout_bank: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  paystack_subaccount_code: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Payout {
  id: string;
  host_id: string;
  event_id: string | null;
  amount: number;
  platform_fee: number;
  status: "pending" | "approved" | "paid" | "declined";
  created_at: string;
}

export type ReservationStatus = "pending" | "confirmed" | "declined" | "paid";

export interface Reservation {
  id: string;
  user_id: string;
  venue_name: string;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  event_name: string;
  event_type: string | null;
  date: string;
  time: string;
  group_size: number;
  special_requests: string | null;
  contact_phone: string | null;
  status: ReservationStatus;
  commission_amount: number | null;
  admin_notes: string | null;
  created_at: string;
}

// A reservation joined with the requester's basic info (admin view).
export interface ReservationWithUser extends Reservation {
  users: { name: string | null; email: string } | null;
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
  event_type: "general" | "private";
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
  paid: boolean;
  created_at: string;
  users: (PublicProfile & { gender?: string | null }) | null;
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
