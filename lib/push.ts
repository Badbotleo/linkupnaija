// Client-side Web Push helpers: register the service worker, subscribe the
// browser, and persist the subscription. The VAPID *public* key is safe to ship
// to the client (the private key lives only in a Supabase secret).

import { createClient } from "@/lib/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BFVWrxlKXm6C7En4nY-ialeU5m07EaD3SbvLU6Lj1IrWSsJqIxTq73m-xacAqB2MYHb5OZB_ZjLJhlagFOpSdXk";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

// Requests permission, subscribes, and saves to push_subscriptions. Returns
// true on success. Safe to call repeatedly (upserts by endpoint).
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const json = sub.toJSON();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: "endpoint" }
  );
  return !error;
}

export async function pushStatus(): Promise<"unsupported" | "granted" | "denied" | "default"> {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}
