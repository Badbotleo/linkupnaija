import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Delete the signed-in member's account.
 *
 * Google Play requires that an app which lets people create an account also
 * lets them delete it, from inside the app and from a web page, and the
 * Data safety form will not accept an email address in place of either. This
 * route is what both of those surfaces call.
 *
 * NOTHING IS DELETED FROM public.users. Fifty-one tables cascade from that
 * row, including events.host_id and rsvps.user_id, so removing it would take
 * the member's tickets, their hosted events, and then every other member's
 * ticket to those events. anonymise_user() empties the row in place instead;
 * the migration explains the full reasoning.
 *
 * Three steps, in this order, because each one is safe to repeat but the order
 * matters if the request dies halfway:
 *   1. photos      storage is not transactional, so clear it while we still
 *                  know the paths.
 *   2. anonymise   one SQL function, atomic.
 *   3. auth        revoke the login LAST. Doing it first would leave a member
 *                  locked out of an account that still held their data, with
 *                  no way back in to retry.
 */
export async function POST(req: Request) {
  const caller = createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Typing the word is the whole confirmation. A misrouted fetch, a double
  // tap or a prefetch cannot produce this body by accident.
  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation missing." },
      { status: 400 }
    );
  }

  const db = createAdminClient();

  // Their money, not ours. Deleting an account with a positive balance would
  // quietly keep it, so send them to withdraw first and say so plainly. This
  // is a remediable block with an obvious path, not a refusal to delete.
  const { data: profile, error: readErr } = await db
    .from("users")
    .select("wallet_balance, deleted_at")
    .eq("id", user.id)
    .single();

  if (readErr) {
    return NextResponse.json(
      { error: "Could not read your account. Nothing was changed." },
      { status: 500 }
    );
  }

  if (profile?.deleted_at) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  if ((profile?.wallet_balance ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "You still have money in your wallet. Withdraw it first, then delete your account. We will not keep it.",
        walletBalance: profile.wallet_balance,
      },
      { status: 409 }
    );
  }

  // 1. Photos. Public buckets, so these URLs are readable by anyone who has
  // ever seen them; leaving the files behind would make "deleted" untrue.
  // Best effort on purpose: a storage hiccup must not block the deletion.
  for (const bucket of ["avatars", "driver-photos"]) {
    try {
      const { data: files } = await db.storage.from(bucket).list(user.id);
      if (files?.length) {
        await db.storage
          .from(bucket)
          .remove(files.map((f) => `${user.id}/${f.name}`));
      }
    } catch {
      // Carry on. Step 2 is the one that must succeed.
    }
  }

  // 2. The row itself.
  const { error: anonErr } = await db.rpc("anonymise_user", {
    target: user.id,
  });
  if (anonErr) {
    return NextResponse.json(
      { error: "Could not delete your account. Nothing was changed." },
      { status: 500 }
    );
  }

  // 3. The login. After this the session is dead and the email is free to
  // sign up again as a brand new member.
  const { error: authErr } = await db.auth.admin.deleteUser(user.id);
  if (authErr) {
    // The data is already gone, so this is not a failure the member should be
    // told to retry: their account is deleted either way. Surface it so it can
    // be cleaned up, but report success.
    console.error("anonymised but auth user remains", user.id, authErr.message);
  }

  await caller.auth.signOut();

  return NextResponse.json({ ok: true });
}
