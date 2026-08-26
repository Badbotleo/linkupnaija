# Maintaining LinkUpNaija

Written so this codebase can be run and changed by a person with no prior
context. It is deliberately about the things that are **not** obvious from
reading the code: the traps that have already caused real bugs, the
conventions that look arbitrary until you know why, and the operational state
of the live system.

If you use an AI assistant, point it at this file first.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # typecheck; run this before every commit
```

Stack: Next.js 14 (App Router), TypeScript, Tailwind, Supabase (Postgres +
Auth + Storage + Edge Functions), Paystack, Resend. Deployed on Vercel from
`main` — pushing to `main` deploys.

Secrets live in `.env.local` (never committed) and, for Edge Functions, in
Supabase's own secret store (`supabase secrets list`).

---

## Five traps that have actually caused bugs here

These are not hypothetical. Each one shipped a real defect.

### 1. A blocked Supabase query returns nothing, not an error

RLS refusing a read gives you `data: []` with `error: null`. An empty result
and "you are not allowed" are indistinguishable. The same applies to writes:
an insert or update the policy rejects affects zero rows and reports success.

**Always `.select()` after a write and check the row count.** See
`components/circles/CircleCoverButton.tsx` for the pattern, and
`supabase/migration-auto-confirm.sql` for the incident that taught it — an
insert policy allowed only `'pending'`, so every reserve-first join was
silently discarded for weeks.

`site_visits` is **write-only** by design: it has an insert policy and no
select policy, so reads return zero rows to everyone. Analytics is read
through `security definer` RPCs (`site_traffic`, `site_top_pages`,
`site_poster_scans`, …), each of which checks `users.is_admin` in its body.

### 2. The global `.dark` layer rewrites exact class names only

`app/globals.css` has an override block mapping light utilities to dark ones
(`.dark .bg-white`, `.dark .text-gray-700`, …). It matches **exact class
names**. It does not match:

- opacity variants — `bg-white/95`, `text-naija-800/80`
- gradient stops — `from-naija-100`, `to-brand-50`

So pairing an overridden text colour with a non-overridden background gives
you light text on a light surface. That shipped twice: the Outdoors category
card at **1.12:1** contrast, and the "Request sent" chip at **1.34:1**, both
against a 4.5:1 floor.

**When adding a dark override, check every place the class is used.** Prefer a
colour with no override (`emerald-800`) over adding more overrides.

### 3. `tsconfig` targets ES5

- No spreading Map/Set iterators — use `Array.from(...)`
- No `u` regex flag — `/\p{L}/u` is a compile error

### 4. `position: fixed` needs a portal

iOS Safari clips a fixed-position descendant of an `overflow-hidden` ancestor.
Six components have hit this. Any modal, sheet or lightbox must
`createPortal(..., document.body)`. See `components/ui/ImageLightbox.tsx`.

### 5. `next build` while `next dev` is running breaks the dev server

It overwrites `.next` and you get `Cannot find module './vendor-chunks/...'`.
Stop dev, `rm -rf .next`, restart.

---

## Migrations

Plain `.sql` files in `supabase/`, run by hand in the Supabase SQL editor.
There is no migration runner and no ordering table.

Conventions, which matter:

- **Every migration is written to be re-runnable.** `create or replace`,
  `add column if not exists`, `drop policy if exists` then `create policy`.
- **Because they are re-runnable, a changed value must be changed in the
  original file too.** When the withdrawal floor moved from ₦1,000 to ₦3,000,
  `migration-wallet-referrals.sql` was edited as well as a new migration
  added — otherwise re-running the old file silently reverts the rule.
- **Read-only counting queries at the end** of anything that changes
  behaviour for existing users, so you can see who it affects before
  announcing it.
- The Supabase SQL editor is a plain statement runner. **psql meta-commands
  (`\set`, `:'var'`) are rejected.**

`supabase/schema.sql` is the base; everything else layers on top.

---

## Non-obvious systems

| Where | What it does and why |
|---|---|
| `lib/generated-art.ts` | Shared palette/hash/monogram for drawn covers. `CircleArt` draws people joined to a centre; `VenueArt` draws a place pinned on a street. Both replace stock photos, which repeat across a grid and quietly say the listing isn't real. |
| `lib/social-proof.ts` | The single rule for talking about small numbers. Never invents a count; stays qualitative under 5 ("Filling up") and switches tense for past events ("Wrapped", "12 went"). Everything showing a count imports from here. |
| `lib/geo-scope.ts` | Scopes the feed to a dense state (Lagos, Abuja) so a Lagos visitor isn't shown Abuja parties. Returns null in local dev — the state comes from a Vercel edge header that doesn't exist locally. |
| `lib/poster-codes.ts` | Printed QR codes → destination + admin label. `/p/<code>` records the scan then redirects. Exists because a QR scan has no referrer and `VisitRecorder` strips the query string, so `?ref=` is invisible. Paths **are** recorded. |
| `lib/qr.ts` | Canonical QR config. Always points at the production origin so a printed code works regardless of where it was generated. |
| `lib/category-groups.ts` | Groups categories for the filter UI. **Throws at import time** if any `EVENT_CATEGORIES` entry is ungrouped — a runtime throw `next build` cannot catch. Add a category, add it to a group. |
| `components/AppHeader.tsx` | The app-style screen header. `subtitle` is for counts/location/status, **not** a tagline; marketing copy there is what makes a screen look like a website. |
| `components/events/JoinSheet.tsx` | One-tap join. Offers email-code first inside TikTok/Instagram in-app browsers, because Google OAuth cannot complete there. |

---

## Operational state

Check these before assuming something is broken.

**Phone verification is built and deployed but not switched on.** Both Edge
Functions (`phone-send-otp`, `phone-verify-otp`) are live. What's missing is a
Termii API key and an approved sender ID (requested, pending at time of
writing). Order of operations:

1. Sender ID approved; confirm **DND is enabled for Nigeria** on the Termii
   workspace, or a large share of Nigerian numbers never receive the SMS
2. Set `TERMII_API_KEY` and `TERMII_SENDER_ID`; **unset `OTP_TEST_MODE`**
3. Redeploy `phone-send-otp`
4. Verify a real number end to end
5. Only then run `supabase/migration-host-phone-gate.sql`

> `OTP_TEST_MODE=true` makes `phone-send-otp` return the code in its own HTTP
> response. Anyone can then "verify" any number. It must be unset before the
> host gate means anything.

**Migrations written but possibly not run** — check before assuming a feature
is off:

- `migration-poster-analytics.sql` — the admin poster-scan section
- `migration-admin-circle-cover.sql` — admin editing of circle covers
- `migration-host-phone-gate.sql` — do not run until SMS works (above)

**Security follow-ups:**

- Rotate the Resend key
- Restrict the MapTiler key (`NEXT_PUBLIC_MAPTILER_KEY`) to owned domains — it
  is publishable and ships to the browser, so restriction is the only control
- Never commit `.env.local`; `PAYSTACK_SECRET_KEY` is server-only
- Secret-scan before committing:
  `git diff | grep -inE "sk-ant-|sbp_|re_[A-Za-z0-9]{8}|pk_live_"`

---

## Money

Two numbers that must agree between the database and the UI, and are enforced
in the database because both RPCs are granted to `authenticated`:

- **Referral reward: ₦600 each side** (`complete_referral`). A completed
  referral costs ₦1,200, since both people are paid.
- **Minimum withdrawal: ₦3,000** (`request_wallet_withdrawal`) — five
  referrals exactly.

The reward is quoted in eleven places in the UI, including the support bot's
own knowledge in `app/api/chat/route.ts`. If you change it, change all of
them, or the bot will keep quoting the old figure to users.

---

## House style

- Comments explain **why**, especially why something is not the obvious
  approach. The codebase is written this way throughout; match it.
- No em dashes in user-facing copy.
- Verify changes in the browser before claiming they work. A typecheck proves
  it compiles, not that it renders.
- Never show a confident zero when data is missing — say the data isn't there.
  A section that renders "0 visitors" because a migration hasn't run reads as
  "nobody came".
