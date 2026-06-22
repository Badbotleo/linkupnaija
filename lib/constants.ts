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
};

export function categoryGradient(category: string) {
  return (
    CATEGORY_GRADIENTS[category as EventCategory] ?? "from-brand-400 to-brand-700"
  );
}
