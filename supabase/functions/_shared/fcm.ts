/**
 * Firebase Cloud Messaging, HTTP v1.
 *
 * ONE SENDER FOR BOTH STORES. Firebase relays to APNs once the APNs auth key
 * is uploaded in the Firebase console, so an iOS device and an Android device
 * are the same call from here. The alternative is signing a separate ES256
 * token for Apple and maintaining two delivery paths for one notification.
 *
 * THE LEGACY API IS GONE. Older guides use a server key and a POST to
 * fcm.googleapis.com/fcm/send. Google shut that down, and v1 needs a real
 * OAuth2 access token minted from a service account. That is what most of
 * this file does, because Deno has no Firebase Admin SDK and pulling one in
 * for a single HTTP call is not worth the cold start.
 *
 * SECRET: FCM_SERVICE_ACCOUNT, the whole service-account JSON as one string.
 * Firebase console > Project settings > Service accounts > Generate new
 * private key. It contains a private key, so it belongs in Supabase secrets
 * and nowhere near the repo.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** Cached across invocations: a token is good for an hour and minting one
 *  costs an RSA sign plus a round trip to Google. */
let cached: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

function b64url(bytes: Uint8Array | string): string {
  const b =
    typeof bytes === "string"
      ? btoa(bytes)
      : btoa(String.fromCharCode(...bytes));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PEM to the ArrayBuffer WebCrypto wants. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    // The JSON carries the key with literal \n sequences, not newlines.
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** An OAuth2 access token for the FCM scope, minted from the service account. */
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;

  let signature: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned)
    );
  } catch (e) {
    console.error("FCM: could not sign the assertion", e);
    return null;
  }

  const jwt = `${unsigned}.${b64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.error("FCM token exchange failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface NativeSendResult {
  sent: number;
  /** Tokens FCM says are dead, for the caller to delete. */
  dead: string[];
  skipped?: string;
}

/**
 * Send one notification to a set of device tokens.
 *
 * Returns the tokens FCM rejected as unregistered rather than deleting them
 * here, so the caller owns its own table and this file stays a transport.
 */
export async function sendNative(opts: {
  tokens: { token: string; platform: "ios" | "android" }[];
  title: string;
  body: string;
  /** In-app path, e.g. /events/123. NativeShell reads it on tap. */
  url: string;
}): Promise<NativeSendResult> {
  if (!opts.tokens.length) return { sent: 0, dead: [] };

  const sa = serviceAccount();
  if (!sa) return { sent: 0, dead: [], skipped: "FCM_SERVICE_ACCOUNT not set" };

  const token = await accessToken(sa);
  if (!token) return { sent: 0, dead: [], skipped: "could not mint an FCM token" };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  const dead: string[] = [];

  // One request per token. FCM's batch endpoint was removed with the legacy
  // API, and at this size the loop is not the bottleneck.
  for (const t of opts.tokens) {
    const message: Record<string, unknown> = {
      token: t.token,
      notification: { title: opts.title, body: opts.body },
      // Data rides alongside so the tap handler gets the path on both
      // platforms. FCM requires every data value to be a string.
      data: { url: opts.url },
      android: {
        priority: "high",
        notification: {
          // Matches the Web Push payload, so a member sees the same mark
          // whichever way the notification reached them.
          icon: "ic_stat_icon",
          color: "#534AB7",
          default_sound: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            // Without this, a notification arriving while the app is open
            // is swallowed on iOS rather than shown.
            "content-available": 1,
          },
        },
      },
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        sent++;
        continue;
      }
      const text = await res.text();
      // UNREGISTERED means the app was deleted or the token rotated. 404 is
      // the same thing in HTTP terms. Anything else is transient and the
      // token is left alone: deleting on a 500 would quietly unsubscribe
      // people during an FCM outage.
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) {
        dead.push(t.token);
      } else {
        console.error("FCM send failed", res.status, text.slice(0, 300));
      }
    } catch (e) {
      console.error("FCM send threw", e);
    }
  }

  return { sent, dead };
}
