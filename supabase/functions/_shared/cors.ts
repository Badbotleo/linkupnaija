// Cross-origin headers for the functions a browser calls directly.
//
// WHY THIS EXISTS. Nothing in this project handled CORS, because until now
// every function here was called by cron or by the server, where it never
// comes up. The OTP functions are the first ones a page calls, and a page
// calling them failed with "Failed to send a request to the Edge Function"
// before the request ever arrived.
//
// Two separate things have to be true for a browser call to land:
//
//  1. The function answers the OPTIONS preflight with these headers. A
//     POST carrying Authorization and Content-Type: application/json is not
//     a simple request, so the browser asks permission first and refuses to
//     send the real call without it.
//
//  2. The function is deployed with verify_jwt: false. Browsers never put
//     Authorization on a preflight, so the gateway rejected the OPTIONS with
//     a bare 401 and no CORS headers at all — the function was never reached
//     and had no way to answer. This does NOT make the function public: each
//     one resolves the caller from their JWT and returns 401 itself when
//     there is nobody there. The check moves from the gateway into the
//     handler; it does not go away.
//
// ALLOWLIST, NOT A WILDCARD. The credential here is a bearer token rather
// than a cookie, so "*" would be defensible, but echoing only origins we
// recognise costs nothing and keeps another site from driving these on
// somebody's behalf if a cookie-bearing call is ever added.

const SITE = (Deno.env.get("SITE_URL") ?? "https://www.linkupnaija.com").replace(
  /\/+$/,
  ""
);

const ALLOWED = [
  SITE,
  "https://www.linkupnaija.com",
  "https://linkupnaija.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** Vercel builds every preview on its own hostname, so they are matched. */
const PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow =
    ALLOWED.includes(origin) || PREVIEW.test(origin) ? origin : SITE;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    // Caches and the CDN must not hand one origin's answer to another.
    Vary: "Origin",
  };
}

/** The preflight answer, or null when this is the real request. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { status: 200, headers: corsHeaders(req) });
}
