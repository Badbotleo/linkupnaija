// LinkUpNaija — send a phone verification code via Termii SMS.
//
// Auth: pass the caller's Supabase JWT as Bearer; we resolve the user from it.
// Body: { phone: "+2348012345678" }
//
// Secrets: TERMII_API_KEY, TERMII_SENDER_ID (an approved sender / "N-Alert").
// Deploy: supabase functions deploy phone-send-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OTP_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 45;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Resolve the caller from their JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const phone = (body.phone ?? "").trim();
  if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ""))) {
    return json({ error: "Enter a valid phone number." }, 400);
  }

  // Cooldown to prevent spamming.
  const { data: existing } = await supabase
    .from("phone_verifications")
    .select("last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.last_sent_at) {
    const since = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) {
      return json({ error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SEC - since)}s before resending.` }, 429);
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString();

  await supabase.from("phone_verifications").upsert(
    { user_id: user.id, phone, code, expires_at: expires, attempts: 0, last_sent_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  // Test mode: skip the SMS provider and return the code so the full flow can
  // be exercised without a Termii account. Gate with OTP_TEST_MODE=true; remove
  // it (and set TERMII_API_KEY) before real launch.
  if (Deno.env.get("OTP_TEST_MODE") === "true") {
    return json({ sent: true, test_code: code });
  }

  const apiKey = Deno.env.get("TERMII_API_KEY");
  if (!apiKey) {
    return json({ error: "SMS not configured. Set TERMII_API_KEY." }, 500);
  }

  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: phone.replace(/^\+/, ""),
      from: Deno.env.get("TERMII_SENDER_ID") ?? "N-Alert",
      sms: `Your LinkUpNaija code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`,
      type: "plain",
      channel: "generic",
      api_key: apiKey,
    }),
  });

  if (!res.ok) {
    console.error("Termii error", res.status, await res.text());
    return json({ error: "Couldn't send the code. Try again." }, 502);
  }
  return json({ sent: true });
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
