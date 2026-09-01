"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import LiveSupport from "./support/LiveSupport";
import { LogoMark } from "./Logo";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// "Paddy" is what the product already calls a close friend — "bring your
// paddy", "share a ride with your paddy". Naming the assistant after it makes
// it part of LinkUpNaija rather than a generic bot bolted onto the corner.
const GREETING =
  "How far? 👋 I'm Paddy, your plug on LinkUpNaija. Tell me the vibe you're chasing, ask how anything here works, or let me help you write your event.";

// Starters, so nobody has to guess what it can do.
const PROMPTS = [
  "What's happening this weekend?",
  "Find me a chill spot in Abuja",
  "How do I host an event?",
  "Help me write my event description",
];

/**
 * Renders Paddy's replies.
 *
 * It only understood [label](url), so every **bold** the model produced —
 * and it produces a lot — arrived as literal asterisks in the chat. The fix
 * is to render the bold rather than to tell the model to stop: an assistant
 * that emphasises the important half of a sentence is doing the right thing,
 * and stripping markdown at display time also covers the day it starts using
 * a form nobody anticipated.
 *
 * Links are handled first, then bold inside whatever text is left, so a bold
 * label inside a link doesn't get split in half.
 */
function renderBold(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={`${keyBase}t${k++}`}>{text.slice(last, m.index)}</Fragment>);
    }
    out.push(
      <strong key={`${keyBase}b${k++}`} className="font-bold">
        {m[1]}
      </strong>
    );
    last = re.lastIndex;
  }
  if (last < text.length) {
    out.push(<Fragment key={`${keyBase}t${k++}`}>{text.slice(last)}</Fragment>);
  }
  return out;
}

function renderContent(text: string) {
  // A single leftover asterisk — an unmatched ** or a stray bullet — would
  // otherwise sit in the message looking like a typo.
  const cleaned = text.replace(/(^|\n)\s*\*\s+/g, "$1• ");

  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Fragment key={key++}>
          {renderBold(cleaned.slice(lastIndex, match.index), `p${key}`)}
        </Fragment>
      );
    }
    const [, label, url] = match;
    const internal = url.startsWith("/");
    parts.push(
      <a
        key={key++}
        href={url}
        target={internal ? undefined : "_blank"}
        rel={internal ? undefined : "noopener noreferrer"}
        className="font-semibold text-brand underline underline-offset-2 hover:text-brand-700"
      >
        {label}
      </a>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) {
    parts.push(
      <Fragment key={key++}>
        {renderBold(cleaned.slice(lastIndex), `p${key}`)}
      </Fragment>
    );
  }
  return parts;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Swapped for the human thread; Paddy stays mounted behind it.
  const [human, setHuman] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Let other parts of the app (e.g. the menu drawer) open the assistant.
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("linkup:open-chat", openChat);
    return () => window.removeEventListener("linkup:open-chat", openChat);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await ask(input);
  }

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Something went wrong.");
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Close control, shown only while the panel is up.
          There is no idle floating bubble any more. It was pinned
          bottom-right on every page, which is the corner the events reel puts
          its only call to action in, so on a phone it sat on the right edge of
          "Get a ticket": the primary action of the primary feed with a chat
          bubble parked on it.
          Paddy did not go anywhere. "Ask Paddy" in the menu still opens this
          panel through the linkup:open-chat event, and the live support thread
          inside it is unchanged. Removing the widget outright would have left
          that menu row dispatching to nothing. */}
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="fixed bottom-20 right-4 z-50 grid h-11 w-11 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/25 transition hover:bg-brand-600 active:scale-95 lg:bottom-5 lg:right-5"
        >
          <CloseIcon />
        </button>
      )}

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-5 z-50 flex w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-[transform,opacity] duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
        style={{ height: "500px", maxHeight: "calc(100vh - 8rem)" }}
        role="dialog"
        aria-label="Paddy, the LinkUpNaija assistant"
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 text-white"
          style={{ background: "linear-gradient(135deg, #534AB7 0%, #121212 100%)" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
              <LogoMark size={26} />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                Paddy
                <span className="flex h-1.5 w-1.5 rounded-full bg-naija" />
              </p>
              <p className="text-[11px] text-white/65">
                Your plug for events, spots &amp; hosting
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Handing off to a person replaces the panel body rather than opening
            a second window — two chat threads on one screen is a maze. */}
        {human ? (
          <LiveSupport onBack={() => setHuman(false)} />
        ) : (
        <>
        {/* Thread */}
        <div
          ref={threadRef}
          className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4"
        >
          <AssistantBubble>{renderContent(GREETING)}</AssistantBubble>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 pl-9">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => ask(p)}
                  className="rounded-full border border-brand/25 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:border-brand hover:bg-brand-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <AssistantBubble key={i}>
                {renderContent(m.content)}
              </AssistantBubble>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            )
          )}

          {loading && (
            <AssistantBubble>
              <TypingDots />
            </AssistantBubble>
          )}

          {error && (
            <p className="px-1 text-center text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Paddy anything…"
            className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </form>

        {/* Always reachable. Paddy is useful until it isn't, and the moment it
            isn't is exactly when people give up rather than hunt for a way to
            reach someone. */}
        <button
          type="button"
          onClick={() => setHuman(true)}
          className="border-t border-gray-100 bg-white px-3 py-2 text-[12px] font-bold text-brand transition hover:bg-brand-50"
        >
          Talk to a human →
        </button>
        </>
        )}
      </div>
    </>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50">
        <LogoMark size={20} />
      </span>
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-gray-800 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Paddy is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-brand/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
