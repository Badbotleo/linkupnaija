import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Records a ride payment after Paystack has taken the money.
 *
 * The browser tells us a reference. That is a claim, not evidence, so nothing
 * is written until Paystack itself confirms the charge succeeded and says how
 * much was actually paid. A rider who edits the popup's amount, or replays an
 * old reference, gets nothing out of this route.
 *
 * Two clients on purpose:
 *   caller — the user's session, to find out who is asking.
 *   db     — service role, to write the money columns the trigger protects.
 */
export async function POST(req: Request) {
  const caller = createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { rideId?: string; reference?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  const rideId = body.rideId?.trim();
  const reference = body.reference?.trim();
  if (!rideId || !reference) {
    return NextResponse.json(
      { error: "rideId and reference are both required." },
      { status: 400 }
    );
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Payments are not configured on the server." },
      { status: 500 }
    );
  }

  const db = createAdminClient();

  // The ride must exist, belong to the rider asking, and not already be paid.
  const { data: ride, error: rideErr } = await db
    .from("ride_requests")
    .select(
      "id, user_id, operator_id, quoted_price, estimated_fare, payment_status, paystack_reference"
    )
    .eq("id", rideId)
    .single();

  if (rideErr || !ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }
  if (ride.user_id !== user.id) {
    return NextResponse.json({ error: "Not your ride." }, { status: 403 });
  }
  if (ride.payment_status === "paid") {
    // Idempotent: the popup can fire its callback twice on a flaky connection.
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  // Ask Paystack what actually happened.
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );
  const verify = await verifyRes.json();

  if (!verifyRes.ok || !verify.status || verify.data?.status !== "success") {
    await db
      .from("ride_requests")
      .update({ payment_status: "failed", paystack_reference: reference })
      .eq("id", rideId);
    return NextResponse.json(
      { error: verify.data?.gateway_response || "Payment was not successful." },
      { status: 402 }
    );
  }

  // A reference may only ever pay for one ride.
  const { data: clash } = await db
    .from("ride_requests")
    .select("id")
    .eq("paystack_reference", reference)
    .neq("id", rideId)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: "That payment reference belongs to another ride." },
      { status: 409 }
    );
  }

  // What the rider was actually charged, from Paystack, in naira.
  const riderTotal = Math.round((verify.data.amount ?? 0) / 100);

  // Our cut, as Paystack split it. `transaction_charge` is what we asked for;
  // trust Paystack's figure over our own arithmetic so the ledger matches the
  // money. Fall back to the operator's rate only if the split is absent.
  const splitCharge = verify.data.split?.shares?.integration;
  let commission: number;
  let commissionPercent: number | null = null;

  if (typeof splitCharge === "number") {
    commission = Math.round(splitCharge / 100);
  } else {
    const { data: op } = await db
      .from("operators")
      .select("commission_percent")
      .eq("id", ride.operator_id)
      .maybeSingle();
    commissionPercent = Number(op?.commission_percent ?? 5);
    const fare = ride.quoted_price ?? ride.estimated_fare ?? 0;
    commission = Math.ceil((fare * commissionPercent) / 100);
  }

  const fare = ride.quoted_price ?? ride.estimated_fare ?? riderTotal - commission;

  const { error: updErr } = await db
    .from("ride_requests")
    .update({
      payment_status: "paid",
      paystack_reference: reference,
      paid_at: new Date().toISOString(),
      rider_total: riderTotal,
      commission_amount: commission,
      operator_amount: fare,
      commission_percent: commissionPercent,
      status: "confirmed",
    })
    .eq("id", rideId);

  if (updErr) {
    // The money is taken. Never tell the rider it failed, or they will pay
    // twice; surface it loudly instead so it can be fixed by hand.
    console.error("[rides/confirm-payment] paid but not recorded", {
      rideId,
      reference,
      updErr,
    });
    return NextResponse.json(
      {
        ok: true,
        warning:
          "Payment succeeded but we could not update the booking. Support has been notified.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    riderTotal,
    commission,
    operatorAmount: fare,
  });
}
