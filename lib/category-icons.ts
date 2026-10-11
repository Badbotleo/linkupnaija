import { PATHS } from "@/components/ui/LineIcon";

/**
 * A line glyph for a category, instead of an emoji.
 *
 * WHY THIS EXISTS. The homepage chip row used emoji, and emoji standing in
 * for an icon set is the single loudest signal that nobody designed a site.
 * Somebody told us it "looked AI-ish" and they were right about the chrome,
 * if not about the content. We already owned 47 stroke glyphs in LineIcon;
 * the site just was not using them.
 *
 * NOT EVERY CATEGORY IS HERE AND THAT IS FINE. There are 95 categories and
 * mapping all of them would mean drawing fifty icons to be used once each.
 * The chips on the home page are what a stranger sees first, so those are
 * mapped and everything else falls through to `sparkles`. CATEGORY_STYLES
 * keeps its emoji for the card badges, where a small coloured mark is doing
 * a different job.
 */
export const CATEGORY_ICON: Record<string, keyof typeof PATHS> = {
  // The home page chip row.
  Party: "sparkles",
  "Game Night": "gamepad",
  "Beach Day": "wave",
  Concert: "mic",
  Clubbing: "volume",
  Dinner: "utensils",
  Hiking: "mountain",
  Karaoke: "music",
  Bowling: "bowling",
  "Pool Party": "sun",

  // The rest of the obvious ones, so a filter page is not half and half.
  "Beach Party": "wave",
  "Live Music": "music",
  "Afrobeats Night": "music",
  "Listening Party": "volume",
  "Silent Disco": "volume",
  "Open Mic": "mic",
  "Comedy Night": "mic",
  "Board Games": "gamepad",
  "Game Tournament": "trophy",
  Sports: "trophy",
  "Sports Viewing": "video",
  Fitness: "activity",
  "Gym Session": "activity",
  Jogging: "activity",
  Cycling: "activity",
  "Wellness Walk": "activity",
  Camping: "mountain",
  Sightseeing: "pin",
  "Road Trip": "car",
  "Travel / Road Trip / Group Adventure": "car",
  "Boat Cruise": "wave",
  "Day Party": "sun",
  Brunch: "utensils",
  "Breakfast Hangouts": "utensils",
  "Food / Grill / Culinary": "utensils",
  "Food Festival": "utensils",
  "Street Food": "utensils",
  "Food Tasting": "utensils",
  "Cooking Class": "utensils",
  "Suya Night": "utensils",
  "Coffee Meetup": "utensils",
  "Movie Screening": "video",
  "Photography Walk": "camera",
  "Art Gallery": "image",
  "Art Exhibition": "image",
  "Paint and Sip": "image",
  "Tech Meetup": "zap",
  "Startup / Pitch Night": "trending",
  "Business Meetup": "trending",
  "Career Fair": "briefcase",
  Conference: "building",
  Seminar: "building",
  Workshop: "settings",
  Masterclass: "star",
  "Book Club": "chat",
  "Language Exchange": "chat",
  Volunteering: "heart",
  "Charity Event": "heart",
  "Singles Meetup": "heart",
  "Mental Health Talk": "heart",
  "Family Hangout": "users",
  "Friend Reunion": "users",
  "Girls Hangout": "users",
  "Alumni Meetup": "users",
  "Community & Social": "users",
  Birthday: "gift",
  "Baby Shower": "gift",
  "Graduation Party": "star",
  Owambe: "sparkles",
  Festival: "sparkles",
  Carnival: "sparkles",
  "Detty December": "sparkles",
  "After-Party": "sparkles",
  "Rooftop Party": "sparkles",
  "Market / Trade Fair": "ticket",
  "Product Launch": "zap",
};

/** The glyph for a category, falling back to something harmless. */
export function categoryIcon(category: string): keyof typeof PATHS {
  return CATEGORY_ICON[category] ?? "sparkles";
}

/**
 * The venue categories, which kept their emoji when the event chips lost
 * theirs. Same reasoning: these chips are the first thing on /venues.
 *
 * Keyed off VENUE_CATEGORIES in lib/overpass.ts. That list still carries an
 * emoji per category because the map pins use it, and a pin is a different
 * problem — it is a coloured dot on a map, not UI chrome.
 */
export const VENUE_ICON: Record<string, keyof typeof PATHS> = {
  Clubs: "volume",
  Restaurants: "utensils",
  Cinemas: "video",
  Parks: "tree",
  Bars: "glass",
  Gyms: "activity",
  Bowling: "bowling",
  Karaoke: "mic",
  Museums: "building",
  Beaches: "sun",
  Stadiums: "trophy",
  Hotels: "bed",
  Camping: "mountain",
  "Cafés": "cup",
  "Event Centres": "ticket",
  "Art Galleries": "image",
  "Amusement Parks": "sparkles",
  Golf: "flag",
  Swimming: "wave",
  Malls: "bag",
  Arcades: "gamepad",
};

/** The glyph for a venue category, falling back to a map pin. */
export function venueIcon(category: string): keyof typeof PATHS {
  return VENUE_ICON[category] ?? "pin";
}
