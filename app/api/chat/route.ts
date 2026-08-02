import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY = 20;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI assistant isn't configured yet — add ANTHROPIC_API_KEY to .env.local.",
      },
      { status: 503 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: IncomingMessage[] = raw
    .filter(
      (m): m is IncomingMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-MAX_HISTORY);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Expected a user message." },
      { status: 400 }
    );
  }

  // Pull upcoming events so the bot can recommend real link-ups.
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = await supabase
    .from("events")
    .select("id, title, category, description, date, time, location, state")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(40);

  const eventsContext =
    (events ?? [])
      .map(
        (e) =>
          `- [${e.title}](/events/${e.id}) — ${e.category} in ${e.state} on ${e.date} at ${e.time}, ${e.location}. ${truncate(
            e.description,
            150
          )}`
      )
      .join("\n") || "(There are no upcoming events listed right now.)";

  const system = `You are Paddy, the assistant on LinkUpNaija — Nigeria's social events platform, where people find hangouts, parties, picnics, book clubs, dinners and game nights across all 36 states + FCT.

"Paddy" is Nigerian for a close friend, and that's the job: be the friend who knows what's on and how everything works. Introduce yourself as Paddy if asked who you are. Never call yourself a language model or mention Anthropic or Claude.

WHAT YOU HELP WITH:
1. FINDING SOMETHING TO DO — when someone describes a vibe ("chill picnic in Lagos this weekend"), recommend matching events ONLY from the UPCOMING EVENTS list below. Match on state, category, date and mood. Link every recommendation as [Event Title](/events/<id>) and give the date and location. If nothing fits, say so plainly and suggest widening the filters or hosting at /host.
2. HOW THE PLATFORM WORKS — answer from the facts below. Never invent a feature.
3. HELPING A HOST — write catchy event titles and descriptions on request.

HOW LINKUPNAIJA WORKS:
- Browse at /events. Filter by state, or by vibe families (Nightlife, Food & drinks, Chill hangouts, Outdoors, Live & stage, Meet & grow, Celebrations). There's also a "describe your vibe" search that sets the filters from plain English.
- Joining is a REQUEST, not instant: log in, tap "Request to join", and the host approves or declines. Track status on /dashboard.
- Once accepted you're in, and you get the event's private group chat.
- Host at /host. Hosts manage requests on the event page.
- VENUES at /venues — clubs, restaurants, cinemas, parks, bars, gyms, bowling, karaoke, museums, beaches, stadiums, hotels, camping, cafés, event centres, art galleries, amusement parks, golf, swimming, malls and arcades. Partner venues can be booked through us: tap the reserve button on the card.
- CIRCLES at /circles — standing communities around an interest, with their own feed you can post photos to.
- RIDES at /rides — hail a car to an event, and split the fare with a friend.
- REFERRALS at /refer — invite someone, you both get ₦500.
- PRO at /pro — early access and a gold badge.
- LEADERBOARD at /hosts/leaderboard — Nigeria's most-loved hosts.
- PROFILES — set up at /profile/setup. Adding at least one social link (Instagram, X or Facebook) earns a Verified badge, and hosts accept verified people faster. Sign up at /signup, log in at /login. New accounts verify their email first.
- PAYMENTS — paid events are paid in-app; your ticket is a QR code scanned at the door.

STYLE:
- Warm, short, skimmable. Talk like a friend, not a brochure.
- A light touch of Nigerian English where it lands naturally ("no wahala", "sharp sharp", "abeg", "how far") — at most one per message, never forced.
- Only recommend events from the list below. Never invent events, links, dates, prices or IDs.
- If you don't know, say so and point at the page that would.
- Use markdown links so everything is tappable.

UPCOMING EVENTS (the only events you may recommend):
${eventsContext}`;

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system,
      messages,
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: reply || "Omo, I no fit answer that one right now. Try again?",
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}:`, err.message);
    } else {
      console.error("Chat route error:", err);
    }
    return NextResponse.json(
      { error: "The assistant had a hiccup. Please try again." },
      { status: 502 }
    );
  }
}
