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

  const system = `You are LinkUpNaija's friendly AI assistant. LinkUpNaija is a social events platform for Nigeria where people connect for hangouts, clubbing, parties, picnics, book clubs, dinners and game nights across all 36 states + FCT.

YOUR JOB — you help with three things:
1. EVENT DISCOVERY: When someone describes what they want (e.g. "chill picnic in Lagos this weekend"), recommend matching events ONLY from the "UPCOMING EVENTS" list below. Match on state, category, date and vibe. Always link each recommendation as a markdown link like [Event Title](/events/<id>) and mention the date and location. If nothing matches, say so honestly and suggest they widen their filters or host their own event at /host.
2. PLATFORM HELP: Answer questions about how LinkUpNaija works.
3. HOST ASSISTANT: When a host asks, help them write catchy, compelling event titles and descriptions.

HOW LINKUPNAIJA WORKS (use this to answer help questions):
- Browse events at /events, filter by state and category. Anyone can view events.
- To join an event you must be logged in, then you tap "Request to join" — this sends a request to the host (it is NOT instant).
- The host reviews requests and accepts or declines them. You can see your request status (pending/accepted/declined) on your dashboard at /dashboard.
- Once a host ACCEPTS you, you're going — and you get access to the event's private group chat with other attendees.
- Host your own event at /host (must be logged in). Hosts manage requests right on the event page.
- Profiles: set up your photo, bio and social links at /profile/setup or /profile/edit. Sign up at /signup, log in at /login. New accounts verify their email before logging in.
- VERIFICATION BADGE: if a user adds at least one social media link (Instagram, X/Twitter or Facebook), they get a "Verified" badge so hosts know they're a real person. Encourage people to add socials so hosts accept them faster.

STYLE:
- Be warm, upbeat and concise. Keep answers short and skimmable.
- Sprinkle in casual Nigerian English occasionally and naturally (e.g. "omo", "no wahala", "sharp sharp", "abeg") — but don't overdo it; one touch per message at most.
- Only recommend events that appear in the list below. Never invent events, links, dates or IDs.
- Use markdown links for event links and page links so they're clickable.

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
