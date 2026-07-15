// LinkUpNaija — deliver a Web Push notification to a user's devices.
//
// Invoked by a DB trigger on `notifications` (so every in-app notification also
// pushes), or manually with { user_id, title, body, url }.
//
// Reads a user's rows from push_subscriptions and sends via VAPID. Dead
// subscriptions (404/410) are pruned.
//
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Deploy: supabase functions deploy send-push --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@linkupnaija.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  // Accept direct calls or a DB-webhook style { record: { ... } }.
  const rec = (body.record ?? body) as Record<string, unknown>;
  const userId = (body.user_id ?? rec.user_id) as string | undefined;
  const message = (body.body ?? rec.message) as string | undefined;
  const title = (body.title as string) ?? "LinkUpNaija";
  const eventId = (body.event_id ?? rec.event_id) as string | undefined;
  const url = (body.url as string) ?? (eventId ? `/events/${eventId}` : "/notifications");

  if (!userId || !message) {
    return json({ error: "user_id and message/body required" }, 400);
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return json({ sent: 0, note: "no subscriptions" });

  const payload = JSON.stringify({ title, body: message, url });
  let sent = 0;
  let pruned = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", s.id);
        pruned++;
      }
    }
  }

  return json({ sent, pruned });
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
