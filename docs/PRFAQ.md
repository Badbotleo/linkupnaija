# LinkUpNaija — Press Release & FAQ

*Working-backwards document. Written as if launching tomorrow, then used to
walk back through the product and find where the promise breaks.*

**Status:** draft 1 · owner: Leonard · last updated 5 Aug 2026

> **How to use this.** The press release is the promise. Every sentence in it
> is a claim a real person should be able to make after using LinkUpNaija.
> Section 3 turns those into testable customer sentences. Anything that fails
> is a bug against the launch, not a nice-to-have — regardless of how new or
> old the code is.

---

## 1. Press release

### LinkUpNaija launches to help Nigerians actually go out

**Lagos, Nigeria —** LinkUpNaija today opened to everyone in Nigeria. It is a
place to find something happening near you this week, ask to join, and turn up
knowing who else will be there.

Going out in Nigeria mostly happens in group chats. A plan gets floated on
Friday, twelve people react, four confirm, one shows up. The people who would
have loved it never heard about it. And if you don't already have the right
chat, you're not going anywhere.

LinkUpNaija replaces the group chat with something built for it. Open the app
and you see what's on near you this week — house parties, beach days, game
nights, owambe, book clubs, live music. Tap one and ask to join.

**The host approves every guest.** That is the part that makes it work.
Nobody walks into a room of strangers who didn't want them there, and no host
gets a stranger they didn't choose. Once you're accepted, you're in the event's
group chat before the day arrives, so you never pull up cold.

For people who'd rather host, setting up takes about two minutes. Pick a vibe,
a spot and a date, and your people get notified. Paid events are paid in-app,
tickets are a QR code scanned at the door, and hosts get paid out after.

LinkUpNaija also handles the parts around the night out: partner venues you can
book through the app, rides to the event with the fare split between friends,
and standing communities — Circles — for the people you keep seeing.

"Nigerians are the most social people on earth, and we were doing it with
tools built for something else," said Leonard, founder of LinkUpNaija. "You
shouldn't need to already know everybody to have somewhere to be on Saturday."

LinkUpNaija is free to use. It is available now across all 36 states and the
FCT at linkupnaija.com.

---

## 2. Customer FAQ

**What does it cost?**
Free to join, free to browse, free to host. Some events charge — that's the
host's ticket price, paid in-app. LinkUpNaija Pro is ₦9,900/month for
unlimited hosting, unlimited join requests, early access to events, profile
boost and a verified badge.

**Why do I have to ask to join instead of just going?**
Because the host approving you is what makes the room good. They see who you
are before they say yes, and you see who's coming before you commit. Instant
joining would make this another events listing site.

**How do I know who else is going?**
The event page shows every accepted guest, with a breakdown of the room. Once
you're accepted you get the event's group chat.

**What if I don't want to host but nothing on the list appeals?**
"Things to do this week" suggests ideas tied to real venues near you — a picnic
at a specific park, dinner at a specific restaurant. If someone's already
hosting that thing, you can join theirs instead of starting your own.

**How do I get there?**
Request a ride to the event from the event page, and split the fare with a
friend who's also going.

**Is my money safe on paid events?**
Payment goes through Paystack. Your ticket is a QR code scanned at the door.
Hosts are paid out after the event, not before.

**What stops fake accounts?**
Adding a social link earns a Verified badge, and hosts approve every guest.
Reported accounts can be restricted or blocked.

**How many events can I host?**
Two a month on the free plan. Pro is unlimited.

---

## 3. The promise, as testable sentences

*Every one of these should be true for a real person on the live site. Walk
each one by actually doing it. Mark it and date it.*

| # | The customer should be able to say | Status | Notes |
|---|---|---|---|
| 1 | "I opened it and saw something on near me this week" | ☐ | Depends on real events existing in their state |
| 2 | "I asked to join and the host got it" | ☐ | Broke silently once (ambiguous FK). Re-verify end to end |
| 3 | "I could see who else was going before I said yes" | ☐ | Guest grid + gender split |
| 4 | "I got into the group chat once accepted" | ☐ | |
| 5 | "I hosted something in about two minutes" | ☐ | Time it. If it's longer, say so |
| 6 | "I paid and I am definitely registered" | ◐ | Migration run 5 Aug. Table, columns and count RPC all live (RPC returns 0). **Insert not proven** — see note |
| 7 | "I found a venue and booked it" | ☐ | Partner venues only; OSM spots aren't bookable |
| 8 | "I rated the venue after I went" | ◐ | Migration run 5 Aug. `venue_reviews` + `reservations.venue_id` live. Untestable until a confirmed reservation has a past date |
| 9 | "A driver actually showed up" | ✗ | Migration run 5 Aug; `/drive` and the review queue work. **Zero approved drivers** — supply, not code |
| 10 | "I got paid out after my event" | ☐ | **Never verified end to end in this build** |
| 11 | "I invited a friend and we both got ₦500" | ☐ | Verify the credit actually lands |
| 12 | "It felt like an app, not a website" | ◐ | 8/12 screens done; signup/login now consistent |

**Verified 5 Aug 2026** — all seven migrations confirmed applied against the
live database, using a known-good table as a control on every run. This matters:
an earlier check returned "missing" for all seven, which was a dropped
connection reporting as a negative result, not a real answer.

**Legend:** ☐ untested · ◐ partly true · ✗ known broken

---

## 4. Internal FAQ

**What's the single biggest risk right now?**
Sentence 10 — payouts. Never walked end to end, no error has ever appeared,
and we have no evidence hosts get paid. Silence is not proof.

Sentence 6 was the biggest risk until 5 Aug. The migration is now applied and
the table, columns, policy and count RPC are all live, so the failure mode is
gone. It stays ◐ rather than ☑ because nobody has actually pushed a row
through the insert on production — writing a junk registration to prove it is
worse than leaving it unproven. Prove it with the next real registration, or
a row written inside a rolled-back transaction.

**Why are so many rows unverified?**
Because most of this was built forwards from "that looks wrong" rather than
backwards from "a customer should be able to say X". Working backwards is
what surfaces sentence 10 — payouts have never been walked end to end, and
nobody noticed because nothing looked broken.

**What are we NOT claiming?**
No user counts, no "thousands of Nigerians", no growth figures. We don't have
them and inventing them would poison every real number later. The press
release deliberately contains no metrics.

**What's the honest state of supply?**
Real, and small. Onboarded partner venues: 19 restaurants, 8 parks, 4 bars,
2 cinemas, 1 museum. Events and hosts are live but thin. Zero approved
drivers. The product should not promise density it doesn't have.

**Seven migrations are unrun. Why does that matter here?**
Four of the twelve sentences fail purely because of it. That's a third of the
promise blocked on one paste into the SQL editor.

**What should the next session do, in order?**
1. Run the migrations, then re-test sentences 6, 8, 9.
2. Walk sentence 10 (payouts) end to end — highest unverified risk.
3. Walk sentences 1–5 as a real user on a phone, timing sentence 5.
4. Only then pick up remaining design work.

**When is this document done?**
When every row reads ☑ with a date, or the claim is removed from the press
release. A promise we can't keep should leave the release, not sit in a
backlog.
