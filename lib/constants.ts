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

export const EVENT_CATEGORIES = [
  "Clubbing",
  "Party",
  "Picnic",
  "Book Club",
  "Dinner",
  "Game Night",
  "Cinema",
  "Sports Viewing",
  "Hiking",
  "Beach Day",
  "Comedy Night",
  "Concert",
  "Art Gallery",
  "Bowling",
  "Karaoke",
  "Pool Party",
  "Yoga",
  "Board Games",
  "Food Festival",
  "Paint and Sip",
  "Networking",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// Each category gets its own badge styling (Tailwind classes).
export const CATEGORY_STYLES: Record<
  EventCategory,
  { badge: string; emoji: string }
> = {
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
