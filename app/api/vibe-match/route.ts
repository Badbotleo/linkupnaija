import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Haiku, not Sonnet. This picks one value from two short lists, which is the
// cheapest kind of work an LLM does, and it sits in front of a search box
// where latency is the whole experience.
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Turns "somewhere chill in Abuja this weekend" into filters the events page
 * already understands. It only ever *picks* — the category and state must come
 * from our own lists, so a hallucinated value can't leak into a query string.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Vibe search isn't switched on yet." },
      { status: 503 }
    );
  }

  let body: { q?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const q = typeof body.q === "string" ? body.q.trim().slice(0, 300) : "";
  if (!q) {
    return NextResponse.json({ error: "Tell me what you're in the mood for." }, { status: 400 });
  }

  const system = `You translate a Nigerian user's plain-English mood into event filters for LinkUpNaija.

Reply with ONLY a JSON object, no prose and no code fences:
{"kind": "vibe" | "name", "category": <one of the categories or null>, "state": <one of the states or null>, "note": "<max 12 words, warm, saying what you picked>"}

CATEGORIES (choose at most one, exactly as written): ${EVENT_CATEGORIES.join(", ")}
STATES (choose at most one, exactly as written): ${NIGERIAN_STATES.join(", ")}

Rules:
- kind is "name" when the text reads like the title of a specific event, a
  venue, a business or a person: "Klub Tempo", "Chia Cafe", "Ada's birthday".
  It is "vibe" when the text describes the kind of night somebody wants:
  "somewhere chill", "owambe in Lagos", "outdoors this weekend". When it could
  be either, say "name" — searching the words is recoverable, silently
  replacing them with a filter is not.
- Use null when the user didn't imply one. Never invent a value outside the lists.
- The note must not contain an em dash or an en dash. Use a comma or a full
  stop. This is a house style rule and it is not negotiable.
- "this weekend", "tonight" and similar timing words don't map to a filter — ignore them for category/state but you may acknowledge them in the note.
- Nigerian slang counts: "owambe" is Owambe, "detty december" is Detty December, "japa"/"link up" are generic, "gbedu"/"turn up" lean Afrobeats Night or Clubbing.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: q }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as {
      kind?: unknown;
      category?: unknown;
      state?: unknown;
      note?: unknown;
    };

    // "name" wins ties by instruction, and an unreadable answer is treated as
    // one: the caller then leaves the typed words alone.
    const kind = parsed.kind === "vibe" ? "vibe" : "name";

    // Whitelist check: anything not in our own lists is dropped, not passed on.
    const category =
      typeof parsed.category === "string" &&
      (EVENT_CATEGORIES as readonly string[]).includes(parsed.category)
        ? parsed.category
        : null;
    const state =
      typeof parsed.state === "string" &&
      (NIGERIAN_STATES as readonly string[]).includes(parsed.state)
        ? parsed.state
        : null;
    // Stripped here as well as asked for in the prompt. A model instruction
    // is a request; this is the guarantee.
    const note =
      typeof parsed.note === "string"
        ? parsed.note.replace(/\s*[\u2013\u2014]\s*/g, ", ").slice(0, 90)
        : "";

    if (!category && !state) {
      return NextResponse.json({
        kind,
        category: null,
        state: null,
        note: "Couldn't pin that down. Try naming a vibe or a state.",
      });
    }

    return NextResponse.json({ kind, category, state, note });
  } catch (err) {
    console.error("vibe-match error:", err);
    return NextResponse.json(
      { error: "Vibe search had a hiccup. Try again?" },
      { status: 502 }
    );
  }
}
