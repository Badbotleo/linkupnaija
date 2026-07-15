// LinkUpNaija — verify a phone OTP and mark the user's number verified.
//
// Auth: caller's Supabase JWT as Bearer. Body: { code: "123456" }
// Deploy: supabase functions deploy phone-verify-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const code = (body.code ?? "").trim();

  const { data: row } = await supabase
    .from("phone_verifications")
    .select("phone, code, expires_at, attempts")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return json({ error: "Request a code first." }, 400);
  if (row.attempts >= MAX_ATTEMPTS)
    return json({ error: "Too many attempts. Request a new code." }, 429);
  if (new Date(row.expires_at).getTime() < Date.now())
    return json({ error: "That code expired. Request a new one." }, 400);

  if (code !== row.code) {
    await supabase
      .from("phone_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("user_id", user.id);
    return json({ error: "Incorrect code." }, 400);
  }

  // Success — mark verified, store the number, clear the OTP row.
  await supabase
    .from("users")
    .update({ phone: row.phone, phone_verified: true, phone_verified_at: new Date().toISOString() })
    .eq("id", user.id);
  await supabase.from("phone_verifications").delete().eq("user_id", user.id);

  return json({ verified: true });
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
