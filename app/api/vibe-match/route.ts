import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { EVENT_CATEGORIES, NIGERIAN_STATES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

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
{"category": <one of the categories or null>, "state": <one of the states or null>, "note": "<max 12 words, warm, saying what you picked>"}

CATEGORIES (choose at most one, exactly as written): ${EVENT_CATEGORIES.join(", ")}
STATES (choose at most one, exactly as written): ${NIGERIAN_STATES.join(", ")}

Rules:
- Use null when the user didn't imply one. Never invent a value outside the lists.
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
      category?: unknown;
      state?: unknown;
      note?: unknown;
    };

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
    const note =
      typeof parsed.note === "string" ? parsed.note.slice(0, 90) : "";

    if (!category && !state) {
      return NextResponse.json({
        category: null,
        state: null,
        note: "Couldn't pin that down — try naming a vibe or a state.",
      });
    }

    return NextResponse.json({ category, state, note });
  } catch (err) {
    console.error("vibe-match error:", err);
    return NextResponse.json(
      { error: "Vibe search had a hiccup. Try again?" },
      { status: 502 }
    );
  }
}
