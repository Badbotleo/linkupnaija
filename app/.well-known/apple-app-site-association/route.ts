/**
 * Universal Links, iOS side.
 *
 * Apple fetches this at install and on app updates. If it matches, a
 * linkupnaija.com link tapped anywhere on the phone opens the app on that
 * page instead of bouncing into Safari.
 *
 * THREE THINGS BREAK THIS SILENTLY, so all three are handled here:
 *
 *   - It must be served as application/json. A file with no extension gets
 *     served as text/plain by a lot of stacks, and Apple rejects it without
 *     saying anything.
 *   - It must be at the apex of /.well-known with NO redirect. Next's
 *     trailing-slash or www canonicalisation would be enough to fail it.
 *   - appID is TEAMID.BUNDLEID. The team id is not the bundle id and is not
 *     guessable: it is in the Apple Developer account, under Membership.
 *
 * APPLE_TEAM_ID is read from the environment rather than hardcoded, because
 * it is account-specific and a wrong value here produces a file that looks
 * perfectly valid and never works.
 */
export const dynamic = "force-static";

const BUNDLE_ID = "com.linkupnaija.app";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? "TEAMID";

  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${BUNDLE_ID}`],
          components: [
            // Everything on the site, except the paths that must stay in a
            // real browser.
            //
            // Paystack's callback lands on /payment, and a payment
            // confirmation that disappears into an app has no address bar
            // for somebody to check who they just paid. Auth callbacks are
            // excluded for the same reason: the OAuth flow has to finish in
            // the browser that started it or the session is lost.
            { "/": "/auth/*", exclude: true },
            { "/": "/payment*", exclude: true },
            { "/": "/api/*", exclude: true },
            { "/": "/*" },
          ],
        },
      ],
    },
    // Not used yet. Present because adding it later means re-verifying the
    // domain, and an empty list costs nothing.
    webcredentials: { apps: [`${teamId}.${BUNDLE_ID}`] },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      // Apple caches this; a day is short enough to fix a mistake and long
      // enough not to be hammered.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
