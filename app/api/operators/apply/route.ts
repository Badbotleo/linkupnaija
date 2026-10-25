import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * A transport company applying to put its fleet on LinkUpNaija.
 *
 * Documents come through here rather than straight from the browser to
 * storage. The form is public, so a client-side storage policy would be free
 * file hosting for anyone who read our JavaScript. Here the type, size and
 * count are checked first and the bucket stays writable only by the service
 * role.
 *
 * Everything lands as `pending`. Nothing an applicant types can approve them,
 * set their commission or point a payout anywhere, because this route never
 * writes those columns and the trigger would refuse them anyway.
 */

const MAX_FILES = 12;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB a file
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Strip anything that could escape the folder or confuse the storage API. */
function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return cleaned || "file";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Send the application as form data." },
      { status: 400 }
    );
  }

  const business_name = String(form.get("business_name") ?? "").trim();
  if (!business_name) {
    return NextResponse.json(
      { error: "A company name is required." },
      { status: 400 }
    );
  }

  const contact_name = String(form.get("contact_name") ?? "").trim() || null;
  const phone = String(form.get("phone") ?? "").trim() || null;
  const email = String(form.get("email") ?? "").trim() || null;
  const state = String(form.get("state") ?? "").trim() || null;
  const city = String(form.get("city") ?? "").trim() || null;
  const rc_number = String(form.get("rc_number") ?? "").trim() || null;
  const tin = String(form.get("tin") ?? "").trim() || null;

  if (!phone && !email) {
    return NextResponse.json(
      { error: "Give us a phone number or an email, or we cannot reply." },
      { status: 400 }
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Please attach no more than ${MAX_FILES} documents.` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${f.name} is larger than 8MB. Compress it and try again.` },
        { status: 400 }
      );
    }
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json(
        { error: `${f.name} is not a PDF or an image.` },
        { status: 415 }
      );
    }
  }

  const db = createAdminClient();

  // A soft brake on repeat submissions. Not a real rate limiter, but it stops
  // the obvious case of one address hammering the form.
  if (email) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("operators")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        {
          error:
            "You have applied a few times this hour already. We have it, give us a day.",
        },
        { status: 429 }
      );
    }
  }

  const { data: row, error: insErr } = await db
    .from("operators")
    .insert({
      business_name,
      contact_name,
      phone,
      email,
      state,
      city,
      rc_number,
      tin,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !row) {
    return NextResponse.json(
      { error: insErr?.message || "Could not save the application." },
      { status: 500 }
    );
  }

  // Documents upload after the row exists, so every file is anchored to a real
  // application and the folder name is the operator id the storage policy
  // checks against.
  const documents: { name: string; path: string; size: number; type: string }[] =
    [];
  const failed: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${row.id}/${String(i + 1).padStart(2, "0")}-${safeName(file.name)}`;
    const { error: upErr } = await db.storage
      .from("operator-docs")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) {
      failed.push(file.name);
      continue;
    }
    documents.push({ name: file.name, path, size: file.size, type: file.type });
  }

  if (documents.length) {
    await db.from("operators").update({ documents }).eq("id", row.id);
  }

  // The application is saved either way. A failed upload is worth saying, but
  // it must not read as though the whole thing was lost.
  return NextResponse.json({
    ok: true,
    id: row.id,
    uploaded: documents.length,
    failed,
  });
}
