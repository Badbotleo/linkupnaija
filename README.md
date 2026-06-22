# LinkUpNaija 🇳🇬

Nigeria's social events platform — connect for hangouts, clubbing, parties,
picnics, book clubs, dinners and game nights across all 36 states + FCT.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS** and
**Supabase** (auth + Postgres).

## Features

- 🏠 Landing page with hero, "how it works", category grid and CTAs
- 🗓️ Events feed with **state dropdown** + **category chip** filters
- 📄 Single event page with full details, attendee list and Join/RSVP
- 🎤 Host form to create new events (protected — must be logged in)
- 🔐 Email + password auth via Supabase
- 👥 Live attendee counts on every card
- 🎨 Purple-themed, mobile-first, card-based UI with per-category colour badges

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the dashboard open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) and **Run** it. This creates the
   `users`, `events` and `rsvps` tables, the sign-up trigger, and Row Level
   Security policies.
3. (Optional) For instant testing without email confirmation, go to
   **Authentication → Providers → Email** and turn **"Confirm email"** off.

### 3. Set environment variables

Copy the example file and fill in your project values (found under
**Project Settings → API**):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  page.tsx                 Landing page
  events/page.tsx          Events feed (filters + grid)
  events/[id]/page.tsx     Single event (details, attendees, RSVP)
  host/page.tsx            Host an event (protected)
  login/ , signup/         Auth pages
  auth/callback/route.ts   Email-confirmation handler
  auth/signout/route.ts    Sign-out handler
components/                Navbar, Footer, EventCard, filters, forms, etc.
lib/
  constants.ts             Nigerian states, categories, category colours
  format.ts                Date/time formatting
  types.ts                 DB row types
  supabase/                Browser + server + middleware clients
middleware.ts              Session refresh + route protection (/host)
supabase/schema.sql        Database schema + RLS + trigger
```

## Notes

- Protected routes: `/host` requires login (enforced in `middleware.ts` and
  re-checked server-side). RSVP and event creation are additionally enforced by
  Supabase RLS policies, so the database is the source of truth.
- Attendee counts use Supabase's aggregate `rsvps(count)` embedding.
