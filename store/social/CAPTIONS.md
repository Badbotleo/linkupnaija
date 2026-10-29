# Social set: captions

Six graphics in `store/social/`, each with its `.source.html` beside it so the
copy can be changed and the PNG re-rendered rather than redrawn. Render command
is at the bottom.

Written for Nigerian feeds, so the captions are short: the graphic carries the
claim and the caption only has to give the reader somewhere to go.

## Two rules the set follows

**One: the headline is the loss, not the feature.** An earlier version led with
"Know who is going before you go", "List at ₦10,000. Get ₦10,000.", "You get
the plate before the car." Every one of those is a description of a settings
screen. Nobody has ever felt "I lack visibility into attendance"; what they
felt was standing by the bar at 9:40 with a drink they paid for. So the big
type is the bad night, the bad payout, the 1am car park, and the product
arrives underneath as the thing that would have prevented it. The small
uppercase `.fix` label is the hinge between the two.

**Two: the set shares a brand, not a layout.** The constants are Plus Jakarta
Sans at 800, the mark, the gold and the grain. Everything else varies. A set
whose posts have the same layout in different words is a template, and in a
feed it reads as one post you have already scrolled past.

This has been got wrong twice, in two different ways, and both are worth
remembering. The first time every post was the same left-aligned stack of
eyebrow, headline, paragraph, object, footer on the same dark field. The second
time the posts were illustrated, which felt like a fix and was not: six night
scenes, one warm light each, a black silhouette holding a lit phone, a cream
card floating to the right, headline bottom-left. Better drawings, same post. A
picture does not rescue a template, it disguises one for about one scroll.

So the rule now is explicit: **no two posts may share all three of time of day,
distance from the subject, and whether there is a person in frame.**

| | Time | Distance | Person | Structure |
|---|---|---|---|---|
| 01 | Night | Overhead, close | No | Scene top, type bottom |
| 02 | Afternoon | Wide interior | Yes | Scene top, type bottom, cream |
| 03 | 1am | Wide exterior | Yes | Scene top, type bottom |
| 04 | Monday morning | Interior, mid | Yes | **Type top, hard-edged band bottom** |
| 05 | No scene | n/a | No | Chat thread, flat purple |
| 06 | No scene | n/a | No | Struck list, flat gold |

Those four columns are what a thumb reads before any of the words.

## What each post is arguing

Adoption needs price, benefits, ease of use and ease of purchase to all hold
up, so the set is checked against those four rather than against a feature
list. Posts 1, 3 and 5 argue benefit, 2 argues price, 6 argues ease of
purchase, 4 announces the app. Ease of use is the one nothing covers yet.

---

## 01-whos-going.png · 1080x1080 · cream

The one to lead with. It is the only claim in the product that no other events
app here makes, so it earns the first post rather than the launch announcement.

> Half the plans you cancel, you cancel because you did not know who else was
> going.
>
> Every event on LinkUpNaija shows you who has already said yes, and which of
> them you know, before you spend anything. Find something on this weekend:
> linkupnaija.com

Tags: `#LinkUpNaija #LagosEvents #EventsInLagos #NaijaEvents #Detty #Abuja #PortHarcourt #ThingsToDoInLagos`

---

## 02-hosts-keep-all.png · 1080x1080 · brand purple

Aimed at hosts, so it belongs in host groups and DMs more than on a feed. The
receipt is the whole argument. Do not add adjectives to it in the caption.

The headline is about the deduction model, which is what this market runs on
and what we ourselves ran on until 1 Sep 2026. It names no competitor, and it
should not start naming one.

> Hosts, read the receipt.
>
> You list at ₦10,000 and you are paid ₦10,000. The 9% booking fee is added on
> top for the buyer and shown to them in full at checkout, so the number on
> your flyer is finally the number that lands in your account.
>
> List your next event free: linkupnaija.com

Tags: `#EventHosts #LagosEvents #TicketingNigeria #EventPlannerNaija #NaijaEvents`

---

## 03-rides.png · 1080x1080 · black, centred

The objection this answers is the one everybody voices first, so it works as a
reply post as much as a scheduled one. The plate is the punchline and it sits
below the headline: question first, evidence second.

> "How will I get home?"
>
> Book the ride when you book the ticket. The cars come from vetted hire
> companies with real papers, and the plate number reaches you before the car
> does.
>
> linkupnaija.com

Tags: `#LagosNightlife #LagosEvents #SafeRide #NaijaEvents #LinkUpNaija`

---

## 04-app-coming.png · 1080x1080 · black, poster

The announcement, and even this one leads with a loss rather than with news
about us. Says "coming soon to Google Play" and carries no Google Play badge:
the mark may only be used once the listing is live, and it is still in closed
testing. Naming Google Play in plain words is fine; the badge is not.

> The LinkUpNaija app is coming.
>
> Everything on the site, full screen and faster, with a nudge when somebody
> you know says they are going. Landing on Google Play soon.
>
> Want early access? Reply with your Gmail address.

Tags: `#LinkUpNaija #GooglePlay #NaijaTech #LagosEvents #AppLaunch`

Swap the last line for the real listing link on the day it goes live, and the
pill for "Now on Google Play". Re-render, do not retype.

---

## 05-story.png · 1080x1920 · flat purple

WhatsApp Status, Instagram and Facebook stories. The top 300px and bottom 340px
are left empty because both apps draw their own chrome over those bands.

No scene and no person in this one, deliberately. It is the post that breaks
the set's run of night illustrations, and it is also the most honest form for
this particular pain: the plan did not die anywhere you could photograph it, it
died in a thread at about six in the evening when four people said "I'm down if
others are" and nobody went first. The last bubble is a typing indicator that
never resolves.

> Four maybes and nobody went.
>
> Somebody always has to go first, and nobody wants it to be them. On
> LinkUpNaija you can see who already said yes before you decide.
>
> linkupnaija.com

Add a link sticker pointing at linkupnaija.com. On WhatsApp Status, paste the
link into the status text instead, since Status has no sticker.

---

## 06-checkout.png · 1080x1080 · gold

The ease-of-purchase post. The other five argue that the product is worth
having; this is the only one that argues it is not a hassle to buy, which is
the part most people quietly assume will be painful.

Built as subtraction: three things you are not being asked to do, struck out,
and one line of what actually happens.

**Before posting this, open a real checkout and look at it.** Which payment
methods a buyer is offered comes from the channels enabled on the Paystack
account, not from anything in `lib/paystack.ts`, which passes no `channels`.
Card and bank transfer are what the graphic claims because those stand on a
default account. Do not add USSD to it without turning USSD on and seeing it.

> Buying a ticket should not involve a DM.
>
> No account details in a caption, no transfer to somebody's personal account,
> no sending proof of payment and waiting for a reply. Pay on the page, and the
> ticket is in your account straight away.
>
> linkupnaija.com

Tags: `#LinkUpNaija #LagosEvents #TicketingNigeria #NaijaEvents #BuyTickets`

---

## Posting order

Three days apart, in this order: 01, 03, 06, 02, 04. Lead with the reason to
care, then the objection about getting home, then the proof that buying is
painless, then the host pitch, then the app. The story runs alongside whichever
square is live that week.

The host post is the one worth boosting with money. The others are worth more
as replies in the groups where people already ask "who is going?".

---

## Re-rendering

From `store/social/`:

```bash
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for s in 01-whos-going 02-hosts-keep-all 03-rides 04-app-coming 06-checkout; do
  "$C" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --window-size=1080,1080 --virtual-time-budget=4000 \
    --screenshot="$s.png" "file://$PWD/$s.source.html"
done
"$C" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=1080,1920 --virtual-time-budget=4000 \
  --screenshot="05-story.png" "file://$PWD/05-story.source.html"
```

`_base.css` holds the four colourways and the shared type. Change it there, not
in one post, or the set stops reading as a set.

A headline that changes has to be re-rendered and looked at, not just edited.
Every one of these is sized by its LONGEST line against an 888px column, and
one extra word silently wraps the headline, which pushes the hero object off
the bottom of the canvas. That has happened twice.
