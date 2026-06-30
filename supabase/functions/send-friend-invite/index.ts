// LinkUpNaija — friend-to-event invite email.
//
// Invoked from the app when a user invites a friend to an event:
//   supabase.functions.invoke("send-friend-invite", { body: { friendId, eventId } })
// The inviter is taken from the caller's JWT. The in-app notification is created
// separately (notify_friend RPC); this function only sends the email.
//
// Deploy: supabase functions deploy send-friend-invite

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SITE_ORIGIN,
  emailLayout,
  heading,
  paragraph,
  button,
  eventCardHtml,
  firstName,
  escapeHtml,
  sendEmail,
} from "../_shared/email.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Identify the inviter from the caller's JWT.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const {
    data: { user: inviter },
  } = await supabase.auth.getUser(token);
  if (!inviter) return json({ error: "unauthenticated" }, 401);

  let friendId: string | undefined;
  let eventId: string | undefined;
  try {
    const body = await req.json();
    friendId = body.friendId;
    eventId = body.eventId;
  } catch {
    /* ignore */
  }
  if (!friendId || !eventId) return json({ error: "friendId and eventId required" }, 400);

  const [{ data: inviterRow }, { data: friend }, { data: event }] =
    await Promise.all([
      supabase.from("users").select("name").eq("id", inviter.id).single(),
      supabase.from("users").select("name, email").eq("id", friendId).single(),
      supabase
        .from("events")
        .select("id, title, date, time, location, state")
        .eq("id", eventId)
        .single(),
    ]);

  if (!friend?.email || !event) return json({ error: "missing friend email or event" }, 404);

  const inviterName = inviterRow?.name ?? "A friend";

  const html = emailLayout({
    title: `${inviterName} invited you to an event`,
    preheader: `${inviterName} wants you to join ${event.title} on LinkUpNaija.`,
    bodyHtml: `
      ${heading(`${escapeHtml(firstName(friend.name))}, you're invited! 🎉`)}
      ${paragraph(
        `<strong>${escapeHtml(inviterName)}</strong> wants you to join them at this event on LinkUpNaija:`
      )}
      ${eventCardHtml(event)}
      ${button(`${SITE_ORIGIN}/events/${event.id}`, "View this event")}
    `,
  });

  const ok = await sendEmail({
    to: friend.email,
    subject: `${inviterName} invited you to "${event.title}" on LinkUpNaija`,
    html,
  });

  return json({ sent: ok });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
