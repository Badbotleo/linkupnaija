# Play Store listing: LinkUpNaija

Package `com.linkupnaija.app`. Paste each block into Play Console exactly as
written. Character counts are Play's hard limits, and the counts below were
measured, not estimated.

---

## App name (30 max)

```
LinkUpNaija
```

11 characters. Leave the rest unused. A name padded with keywords ("LinkUpNaija:
Events & Tickets") reads as spam to both reviewers and users, and Play now
demotes it.

---

## Short description (80 max)

```
Find things to do near you, and see who else is going before you commit.
```

72 characters.

This is the line that appears under the icon in search results, so it carries
more weight than the full description. It leads with the job, not the category,
and the second clause is the thing no other events app in Nigeria does.

### Alternates, if you want to A/B them later

```
Events, circles and tickets for Nigerians who go out.
```
53 characters.

```
See what's happening near you, and who you know who will be there.
```
66 characters.

---

## Full description (4000 max)

```
LinkUpNaija is where Nigerians find something worth leaving the house for, and
see who else is going before they commit.

FIND WHAT'S ON
Browse events near you by city, by night, by the kind of thing you actually
like. Concerts, game nights, church programmes, owambe, football viewing,
tech meetups, art shows. Filter by price, by date, by how far you are willing
to travel.

KNOW WHO WILL BE THERE
Every event shows you who has RSVP'd, including the people you already know.
Going out alone is the reason most plans die. Seeing a familiar name is the
reason they survive.

JOIN A CIRCLE
Circles are small groups built around one thing: a neighbourhood, a hobby, a
club, a course. Post in them, plan in them, and bring the group to an event
together instead of one by one.

BUY TICKETS WITHOUT LEAVING THE APP
Pay with your card, bank transfer or USSD through Paystack. Your ticket is a QR
code in the app, and the door scans it. No screenshots, no WhatsApp forwards, no
wondering whether the ticket you were sold is real.

GET THERE
Book a ride to the event from inside the app. Vehicles come from vetted car hire
companies with real papers, not strangers, and you see your driver and plate
number before they arrive.

FOR HOSTS
Create an event in a few minutes. Sell tickets, see your buyers, scan people in
at the door, and get paid out to your own bank account. Your sales dashboard
updates as they sell.

FOR VENDORS AND CREATORS
A profile that shows your work, your prices and your past bookings, so people
can find you for the next party instead of asking around in group chats.

BUILT FOR NIGERIA
Naira pricing. Paystack payments. Works on a slow connection, and keeps working
when the network drops mid-page. Lagos, Abuja, Port Harcourt, Ibadan and Benin
to start, more cities as the hosts arrive.

Free to use. LinkUpNaija Pro adds early access to tickets, bigger circles and a
verified badge.
```

1,712 characters, well inside the limit, and deliberately so. Play truncates the
description after about three lines on a phone until the user taps "more", so
the first two sentences do nearly all the work. The headed blocks exist for the
people who do tap.

**Check before you paste:** the ride section describes the transport partner
flow. If no car hire company is approved in production when you publish, cut
that whole block. Describing a feature a reviewer cannot find is the most
common reason a first submission is rejected.

---

## Graphics

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512x512 PNG, no transparency | Built: `store/play/icon-512.png` |
| Feature graphic | 1024x500 PNG or JPEG, no transparency | Built: `store/play/feature-graphic-1024x500.png` |
| Phone screenshots | 2 to 8, min 1080px short side, ratio between 16:9 and 9:16 | Needs capture |
| Tablet screenshots | Optional, but their absence caps your store ranking on tablets | Not planned for v1 |

### Screenshots to capture, in this order

Play shows the first two in search results, so they are the only ones most
people see.

1. `/events` with real events loaded, not an empty state
2. An event page showing the attendee avatars, which is the differentiator
3. `/circles` showing a circle with real posts
4. The ticket QR screen
5. `/host` showing the sales dashboard

Capture at **1080x1920**, not at a real phone's resolution. Play requires the
aspect ratio to sit between 16:9 and 9:16, and a modern phone is 9:19.5 or
taller, so a straight device screenshot is rejected for being too tall. 1080x1920
is exactly 9:16 and always passes.

The events page on production is already full of real events, so these do not
need seeding. The signed-in screens do: `/tickets` and `/host` have to be
captured while logged in, which means capturing them yourself rather than from a
headless browser.

---

## Categorisation and contact

- **Category:** Events
- **Tags:** Events, Social, Local
- **Email:** the support address, not a personal Gmail. Play publishes it.
- **Website:** https://linkupnaija.com
- **Privacy policy:** https://linkupnaija.com/privacy-policy (the route exists
  and renders, which Play's crawler checks)

---

## Content rating questionnaire

Answer it honestly, including the parts that feel inconvenient:

- **User-generated content: yes.** Circles and the feed carry user posts. Play
  will then require that you have a reporting mechanism and a moderation
  process, and will ask you to describe them.
- **Users can interact: yes.** Messages and circles.
- **Shares location: yes,** for ride pickup and nearby events.
- **Digital purchases: yes,** tickets and Pro.

Declaring no user-generated content on an app that has it is the one answer that
gets an account suspended rather than an app rejected.

---

## Data safety form

Play audits this against your actual network traffic, so it has to match what
the app really sends:

| Data | Collected | Why | Optional |
|---|---|---|---|
| Name, email | Yes | Account | No |
| Phone number | Yes | Account, ride contact | No |
| Photos | Yes | Profile and event images | Yes |
| Precise location | Yes | Nearby events, ride pickup | Yes |
| Payment info | No, Paystack handles it and we never see a card | n/a | n/a |
| Government ID | Yes, for drivers and transport partners only | Vetting | No, for those roles |

Say that data is encrypted in transit, that users can request deletion, and
point the deletion request at the account settings route. Play requires a
working deletion path, and will test it.

---

## Before you hit publish

- [ ] Internal testing track first, with the real `.aab`, installed on your own
      phone from the Play link rather than sideloaded. Sideloading does not test
      the signing or the install flow.
- [ ] Sign in, buy a ticket, and scan it. On the Play build, not the dev server.
- [ ] Confirm the app opens its own links, so an event link from WhatsApp lands
      in the app and not the browser.
- [ ] Check the icon on a dark home screen and a light one.
