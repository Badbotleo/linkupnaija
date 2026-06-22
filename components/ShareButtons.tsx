"use client";

import { useEffect, useState } from "react";

export default function ShareButtons({
  title,
  dateLabel,
  location,
}: {
  title: string;
  dateLabel: string;
  location: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Resolve the absolute event URL on the client to avoid SSR mismatch.
  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const whatsappText = `Hey! Check out this event on LinkUpNaija: ${title} on ${dateLabel} at ${location}. Join here: ${url}`;
  const twitterText = `Linking up at ${title} on ${dateLabel} 🇳🇬 Join me on LinkUpNaija:`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    twitterText
  )}&url=${encodeURIComponent(url)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    url
  )}`;

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older / non-secure contexts.
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently ignore — clipboard not available.
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Share this event
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* WhatsApp — brand color */}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: "#534AB7" }}
        >
          <WhatsAppIcon />
          WhatsApp
        </a>

        {/* Twitter / X — Twitter blue */}
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: "#1DA1F2" }}
        >
          <XIcon />X
        </a>

        {/* Facebook — Facebook blue */}
        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: "#1877F2" }}
        >
          <FacebookIcon />
          Facebook
        </a>

        {/* Copy link — gray */}
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy event link"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          {copied ? <CheckIcon /> : <LinkIcon />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

/* --- Icons (16px) --- */

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
