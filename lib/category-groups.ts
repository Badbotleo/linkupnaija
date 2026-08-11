import { EVENT_CATEGORIES, type EventCategory } from "./constants";

/**
 * Thirty-six categories in one flat wall of chips is a wall, not a choice.
 * Grouping them into six families lets someone find their vibe by scanning
 * six things instead of thirty-six.
 *
 * The groups are exhaustive by construction — see the assertion below — so a
 * category added to EVENT_CATEGORIES can never quietly vanish from the picker.
 */
export interface CategoryGroup {
  key: string;
  label: string;
  /** One-line hint under the group tile. */
  hint: string;
  emoji: string;
  /** Tailwind classes for the tile's tint. */
  tint: string;
  categories: EventCategory[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "nightlife",
    label: "Nightlife",
    hint: "Turn up till morning",
    emoji: "🪩",
    tint: "from-purple-100 to-purple-50 text-purple-800",
    categories: [
      "Listening Party", "After-Party",
      "Clubbing", "Party", "Afrobeats Night", "Rooftop Party", "Pool Party",
      "Detty December", "Day Party", "Silent Disco",
    ],
  },
  {
    key: "food",
    label: "Food & drinks",
    hint: "Eat, sip, repeat",
    emoji: "🍽️",
    tint: "from-rose-100 to-rose-50 text-rose-800",
    categories: [
      "Food Tasting", "Cooking Class", "Wine / Cocktail Night", "Street Food Tour", "Suya Night", "Coffee Meetup",
      "Dinner", "Brunch", "Food Festival", "Paint and Sip", "Picnic",
      "Street Food",
      "Wine Tasting",
    ],
  },
  {
    key: "chill",
    label: "Chill hangouts",
    hint: "Low-key vibes",
    emoji: "🤗",
    tint: "from-teal-100 to-teal-50 text-teal-800",
    categories: [
      "Family Fun Day", "Kids Event", "Game Tournament",
      "Family Hangout", "Friend Reunion", "Game Night", "Board Games",
      "Book Club", "Cinema", "Sports Viewing", "Trivia Night", "Spa Day",
    ],
  },
  {
    key: "outdoors",
    label: "Outdoors",
    hint: "Beach, hikes, gym",
    emoji: "🏝️",
    tint: "from-naija-100 to-naija-50 text-naija-800",
    categories: [ "Gym Session", "Meditation", "Wellness Walk", "Sports", "Cycling", "Adventure Park", "Photography Walk",
      "Beach Day", "Hiking", "Yoga", "Fitness", "Road Trip", "Bowling",
      "Sightseeing", "Jogging", "Outdoor", "Vacation",
      "Camping", "Boat Cruise", "Go-Karting",
    ],
  },
  {
    key: "stage",
    label: "Live & stage",
    hint: "Music, jokes, art",
    emoji: "🎤",
    tint: "from-amber-100 to-amber-50 text-amber-800",
    categories: [
      "Art Exhibition", "Movie Screening", "Theatre / Drama", "Fashion Meetup", "Fashion Pop-up",
      "Concert", "Live Music", "Comedy Night", "Karaoke", "Open Mic",
      "Art Gallery", "Fashion Show", "Entertainment", "Festival",
    ],
  },
  {
    key: "grow",
    label: "Meet & grow",
    hint: "Rooms worth it",
    emoji: "🤝",
    tint: "from-blue-100 to-blue-50 text-blue-800",
    categories: [
      "Workshop", "Seminar", "Conference", "Career Fair", "Mentorship", "Business Meetup", "Startup / Pitch Night", "Study Abroad", "Skill Training", "Coding / Tech Class", "Language Exchange", "Masterclass", "Mental Health Talk", "Charity Event", "Alumni Meetup", "Faith Gathering", "Singles Meetup", "Market / Trade Fair", "Product Launch","Networking", "Tech Meetup", "Volunteering", "Community & Social"],
  },
  {
    key: "celebrate",
    label: "Celebrations",
    hint: "Somebody's big day",
    emoji: "🎉",
    tint: "from-pink-100 to-pink-50 text-pink-800",
    categories: [
      "Cultural Day", "Carnival", "Owambe", "Birthday", "Baby Shower", "Graduation Party"],
  },
];

// Fail loudly at import time rather than silently dropping a category from
// the picker the day someone adds one to EVENT_CATEGORIES.
const grouped = new Set(CATEGORY_GROUPS.flatMap((g) => g.categories));
const missing = EVENT_CATEGORIES.filter((c) => !grouped.has(c));
if (missing.length > 0) {
  throw new Error(
    `category-groups: ungrouped categories — ${missing.join(", ")}. ` +
      `Add each to a group in lib/category-groups.ts.`
  );
}

export function groupForCategory(cat: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) =>
    (g.categories as readonly string[]).includes(cat)
  );
}
