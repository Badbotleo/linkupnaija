// LinkUpNaija — verify an email OTP and mark the account's email verified.
//
// Auth: caller's Supabase JWT as Bearer. Body: { code: "123456" }
// Deploy: supabase functions deploy email-verify-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // See the long note in email-send-otp. Short version: a service-role client
  // carrying the caller's Authorization header queries as `authenticated`,
  // not as service role, so RLS applies and every write to the OTP table is
  // refused. `caller` identifies the user; `db` does the work.
  const caller = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const db = createClient(url, serviceKey);

  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const code = (body.code ?? "").trim();

  const { data: row, error: readErr } = await db
    .from("email_verifications")
    .select("email, code, expires_at, attempts")
    .eq("user_id", user.id)
    .maybeSingle();

  // A failed read and "no row" are not the same thing. Reporting a database
  // failure as "Request a code first" sends people round the loop forever.
  if (readErr) {
    console.error("email_verifications read failed", readErr.message);
    return json({ error: "Couldn't check that code. Please try again." }, 500);
  }
  if (!row) return json({ error: "Request a code first." }, 400);
  if (row.attempts >= MAX_ATTEMPTS)
    return json({ error: "Too many attempts. Request a new code." }, 429);
  if (new Date(row.expires_at).getTime() < Date.now())
    return json({ error: "That code expired. Request a new one." }, 400);

  // The address the code went to must still be the account's address. A
  // mismatch means the email changed between sending and verifying, and the
  // code proves ownership of an inbox this account no longer uses.
  if (row.email !== (user.email ?? "")) {
    await db.from("email_verifications").delete().eq("user_id", user.id);
    return json(
      { error: "Your email changed. Request a new code." },
      400
    );
  }

  if (code !== row.code) {
    await db
      .from("email_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("user_id", user.id);
    return json({ error: "Incorrect code." }, 400);
  }

  // The write that actually verifies them. Unchecked, a failure here would
  // still clear the OTP row and report success: told they were verified, no
  // flag set, and the code gone so they start over with no idea why.
  const { error: saveErr } = await db
    .from("users")
    .update({ email_verified: true, email_verified_at: new Date().toISOString() })
    .eq("id", user.id);
  if (saveErr) {
    console.error("email verify save failed", saveErr.message);
    // Leave the OTP row so the same code still works on retry.
    return json({ error: "Couldn't save that. Please try again." }, 500);
  }

  await db.from("email_verifications").delete().eq("user_id", user.id);
  return json({ verified: true });
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
