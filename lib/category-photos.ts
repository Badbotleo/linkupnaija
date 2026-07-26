// Stock photo per event/circle category — fallback art for cards that have
// no uploaded cover, so nothing renders as a flat gradient or letter tile.
// Files live in public/venues and public/circles.
const PHOTOS: Record<string, string> = {
  "Family Hangout": "/venues/parks.jpg",
  "Friend Reunion": "/circles/party.jpg",
  Picnic: "/venues/parks.jpg",
  "Book Club": "/circles/bookclub.jpg",
  "Game Night": "/circles/gamenight.jpg",
  "Board Games": "/circles/gamenight.jpg",
  Dinner: "/circles/dinner.jpg",
  "Food Festival": "/circles/dinner.jpg",
  Networking: "/circles/networking.jpg",
  "Paint and Sip": "/venues/museums.jpg",
  Hiking: "/circles/hiking.jpg",
  "Beach Day": "/circles/beachday.jpg",
  Yoga: "/venues/parks.jpg",
  "Art Gallery": "/venues/museums.jpg",
  "Comedy Night": "/venues/karaoke.jpg",
  Cinema: "/venues/cinemas.jpg",
  "Sports Viewing": "/venues/stadiums.jpg",
  Concert: "/circles/concert.jpg",
  Karaoke: "/venues/karaoke.jpg",
  Bowling: "/venues/bowling.jpg",
  "Pool Party": "/venues/hotels.jpg",
  Clubbing: "/venues/clubs.jpg",
  Party: "/circles/party.jpg",
};

export function categoryPhoto(category: string | null | undefined): string {
  return PHOTOS[category ?? ""] ?? "/circles/networking.jpg";
}
