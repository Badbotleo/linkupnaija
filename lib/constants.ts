// Shared constants for LinkUpNaija

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT - Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

// Ordered to lead with family/friendship/connection-oriented gatherings;
// nightlife sits at the end. This order flows through every category list and
// filter across the site.
export const EVENT_CATEGORIES = [
  "Family Hangout",
  "Friend Reunion",
  "Picnic",
  "Book Club",
  "Game Night",
  "Dinner",
  "Networking",
  "Board Games",
  "Paint and Sip",
  "Hiking",
  "Beach Day",
  "Yoga",
  "Food Festival",
  "Art Gallery",
  "Comedy Night",
  "Cinema",
  "Sports Viewing",
  "Concert",
  "Karaoke",
  "Bowling",
  "Pool Party",
  "Clubbing",
  "Party",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Interests — what users pick during onboarding (Substack/Tinder style).
// Grouped for a scannable chip picker. Each interest maps loosely to event
// categories so we can recommend events that match.
// ---------------------------------------------------------------------------
export interface InterestGroup {
  title: string;
  interests: { label: string; emoji: string }[];
}

export const INTEREST_GROUPS: InterestGroup[] = [
  {
    title: "🎉 Nightlife & Social",
    interests: [
      { label: "Parties", emoji: "🎉" },
      { label: "Clubbing", emoji: "🪩" },
      { label: "Karaoke", emoji: "🎤" },
      { label: "Comedy", emoji: "😂" },
      { label: "Concerts", emoji: "🎫" },
      { label: "Pool Parties", emoji: "🏊" },
    ],
  },
  {
    title: "🍽️ Food & Drink",
    interests: [
      { label: "Dining Out", emoji: "🍽️" },
      { label: "Food Festivals", emoji: "🥘" },
      { label: "Paint & Sip", emoji: "🎨" },
      { label: "Coffee & Chill", emoji: "☕" },
      { label: "Cooking", emoji: "👩‍🍳" },
    ],
  },
  {
    title: "🎨 Arts & Culture",
    interests: [
      { label: "Live Music", emoji: "🎶" },
      { label: "Art Galleries", emoji: "🖼️" },
      { label: "Cinema", emoji: "🎬" },
      { label: "Photography", emoji: "📷" },
      { label: "Fashion", emoji: "👗" },
    ],
  },
  {
    title: "🏃 Active & Outdoors",
    interests: [
      { label: "Hiking", emoji: "🥾" },
      { label: "Beach Days", emoji: "🏖️" },
      { label: "Yoga", emoji: "🧘" },
      { label: "Fitness", emoji: "💪" },
      { label: "Football", emoji: "⚽" },
      { label: "Sports Viewing", emoji: "📺" },
    ],
  },
  {
    title: "🧠 Learning & Growth",
    interests: [
      { label: "Book Clubs", emoji: "📚" },
      { label: "Networking", emoji: "🤝" },
      { label: "Tech & Startups", emoji: "💻" },
      { label: "Public Speaking", emoji: "🎙️" },
      { label: "Faith", emoji: "🙏" },
    ],
  },
  {
    title: "🎮 Play & Chill",
    interests: [
      { label: "Board Games", emoji: "♟️" },
      { label: "Video Games", emoji: "🎮" },
      { label: "Movie Nights", emoji: "🍿" },
      { label: "Picnics", emoji: "🧺" },
      { label: "Family Hangouts", emoji: "👨‍👩‍👧‍👦" },
      { label: "Friend Reunions", emoji: "🤗" },
    ],
  },
];

// Flat list of every valid interest label (for validation/lookup).
export const ALL_INTERESTS: string[] = INTEREST_GROUPS.flatMap((g) =>
  g.interests.map((i) => i.label)
);

// Minimum interests we ask a user to pick during onboarding.
export const MIN_INTERESTS = 3;

// Maps an interest label → the event categories that satisfy it. Powers the
// "Picked for you" personalised feed. Interests without a category match
// (e.g. Coffee & Chill, Fashion) simply don't surface events yet.
export const INTEREST_TO_CATEGORIES: Record<string, EventCategory[]> = {
  Parties: ["Party"],
  Clubbing: ["Clubbing"],
  Karaoke: ["Karaoke"],
  Comedy: ["Comedy Night"],
  Concerts: ["Concert"],
  "Pool Parties": ["Pool Party"],
  "Dining Out": ["Dinner"],
  "Food Festivals": ["Food Festival"],
  "Paint & Sip": ["Paint and Sip"],
  Cooking: ["Food Festival", "Dinner"],
  "Live Music": ["Concert"],
  "Art Galleries": ["Art Gallery"],
  Cinema: ["Cinema"],
  Hiking: ["Hiking"],
  "Beach Days": ["Beach Day"],
  Yoga: ["Yoga"],
  Fitness: ["Yoga", "Hiking"],
  Football: ["Sports Viewing"],
  "Sports Viewing": ["Sports Viewing"],
  "Book Clubs": ["Book Club"],
  Networking: ["Networking"],
  "Tech & Startups": ["Networking"],
  "Board Games": ["Board Games", "Game Night"],
  "Video Games": ["Game Night"],
  "Movie Nights": ["Cinema"],
  Picnics: ["Picnic"],
  "Family Hangouts": ["Family Hangout"],
  "Friend Reunions": ["Friend Reunion"],
};

// Union of event categories that match a user's interests.
export function categoriesForInterests(interests: string[]): EventCategory[] {
  const set = new Set<EventCategory>();
  for (const i of interests) {
    for (const c of INTEREST_TO_CATEGORIES[i] ?? []) set.add(c);
  }
  return Array.from(set);
}

// Each category gets its own badge styling (Tailwind classes).
export const CATEGORY_STYLES: Record<
  EventCategory,
  { badge: string; emoji: string }
> = {
  "Family Hangout": { badge: "bg-orange-100 text-orange-700", emoji: "👨‍👩‍👧‍👦" },
  "Friend Reunion": { badge: "bg-teal-100 text-teal-700", emoji: "🤗" },
  Clubbing: { badge: "bg-purple-100 text-purple-700", emoji: "🪩" },
  Party: { badge: "bg-pink-100 text-pink-700", emoji: "🎉" },
  Picnic: { badge: "bg-green-100 text-green-700", emoji: "🧺" },
  "Book Club": { badge: "bg-amber-100 text-amber-700", emoji: "📚" },
  Dinner: { badge: "bg-rose-100 text-rose-700", emoji: "🍽️" },
  "Game Night": { badge: "bg-blue-100 text-blue-700", emoji: "🎮" },
  Cinema: { badge: "bg-indigo-100 text-indigo-700", emoji: "🎬" },
  "Sports Viewing": { badge: "bg-emerald-100 text-emerald-700", emoji: "📺" },
  Hiking: { badge: "bg-lime-100 text-lime-700", emoji: "🥾" },
  "Beach Day": { badge: "bg-cyan-100 text-cyan-700", emoji: "🏖️" },
  "Comedy Night": { badge: "bg-yellow-100 text-yellow-700", emoji: "😂" },
  Concert: { badge: "bg-fuchsia-100 text-fuchsia-700", emoji: "🎶" },
  "Art Gallery": { badge: "bg-rose-100 text-rose-700", emoji: "🖼️" },
  Bowling: { badge: "bg-blue-100 text-blue-700", emoji: "🎳" },
  Karaoke: { badge: "bg-purple-100 text-purple-700", emoji: "🎤" },
  "Pool Party": { badge: "bg-sky-100 text-sky-700", emoji: "🏊" },
  Yoga: { badge: "bg-teal-100 text-teal-700", emoji: "🧘" },
  "Board Games": { badge: "bg-orange-100 text-orange-700", emoji: "🎲" },
  "Food Festival": { badge: "bg-red-100 text-red-700", emoji: "🍢" },
  "Paint and Sip": { badge: "bg-pink-100 text-pink-700", emoji: "🎨" },
  Networking: { badge: "bg-slate-100 text-slate-700", emoji: "🤝" },
};

export function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category as EventCategory] ?? {
      badge: "bg-gray-100 text-gray-700",
      emoji: "✨",
    }
  );
}

// Gradient placeholder (Tailwind classes) used when an event has no cover image.
export const CATEGORY_GRADIENTS: Record<EventCategory, string> = {
  "Family Hangout": "from-orange-400 to-amber-500",
  "Friend Reunion": "from-teal-400 to-cyan-500",
  Clubbing: "from-purple-500 to-indigo-600",
  Party: "from-pink-500 to-rose-500",
  Picnic: "from-green-500 to-emerald-600",
  "Book Club": "from-amber-500 to-orange-600",
  Dinner: "from-rose-500 to-red-600",
  "Game Night": "from-blue-500 to-cyan-600",
  Cinema: "from-indigo-500 to-purple-600",
  "Sports Viewing": "from-emerald-500 to-green-600",
  Hiking: "from-lime-500 to-green-600",
  "Beach Day": "from-cyan-500 to-blue-500",
  "Comedy Night": "from-yellow-400 to-amber-500",
  Concert: "from-fuchsia-500 to-pink-600",
  "Art Gallery": "from-rose-500 to-pink-600",
  Bowling: "from-blue-500 to-indigo-600",
  Karaoke: "from-purple-500 to-fuchsia-600",
  "Pool Party": "from-sky-400 to-cyan-500",
  Yoga: "from-teal-500 to-emerald-600",
  "Board Games": "from-orange-500 to-amber-600",
  "Food Festival": "from-red-500 to-orange-600",
  "Paint and Sip": "from-pink-500 to-rose-500",
  Networking: "from-slate-500 to-gray-600",
};

export function categoryGradient(category: string) {
  return (
    CATEGORY_GRADIENTS[category as EventCategory] ?? "from-brand-400 to-brand-700"
  );
}
