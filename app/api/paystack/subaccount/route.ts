import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Platform keeps 10%; the host's subaccount receives the remaining 90%.
// Paystack's `percentage_charge` is the share that goes to the subaccount.
const PLATFORM_FEE_PERCENT = 10;
const HOST_SHARE_PERCENT = 100 - PLATFORM_FEE_PERCENT;

// Creates (or updates) a Paystack subaccount for the host and stores the
// resulting subaccount_code on their profile, alongside their payout details.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: {
    bank_code?: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { bank_code, bank_name, account_number, account_name } = body;
  if (!bank_code || !bank_name || !account_number) {
    return NextResponse.json(
      { error: "Bank and account number are required." },
      { status: 400 }
    );
  }

  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Payouts are not configured yet (missing PAYSTACK_SECRET_KEY)." },
      { status: 503 }
    );
  }
  if (secret.startsWith("pk_")) {
    return NextResponse.json(
      {
        error:
          "PAYSTACK_SECRET_KEY is set to a public key (pk_…). Use your Paystack SECRET key (sk_…) instead.",
      },
      { status: 500 }
    );
  }

  const authHeader = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Resolve the account to get the verified account name.
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        account_number
      )}&bank_code=${encodeURIComponent(bank_code)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const resolveData = await resolveRes.json();
    if (!resolveRes.ok || !resolveData.status) {
      const msg: string = resolveData.message || "Could not verify the account.";
      const friendly = /invalid key/i.test(msg)
        ? "Paystack rejected the API key. Check that PAYSTACK_SECRET_KEY is a valid live secret key (sk_live_…) with no extra spaces."
        : msg;
      return NextResponse.json({ error: friendly }, { status: 422 });
    }
    const resolvedName: string =
      resolveData.data.account_name || account_name || "LinkUpNaija Host";

    // 2. Create the subaccount (host receives HOST_SHARE_PERCENT of each split).
    const subRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        business_name: resolvedName,
        settlement_bank: bank_code,
        account_number,
        percentage_charge: HOST_SHARE_PERCENT,
      }),
    });
    const subData = await subRes.json();
    if (!subRes.ok || !subData.status) {
      return NextResponse.json(
        { error: subData.message || "Could not create payout subaccount." },
        { status: 422 }
      );
    }
    const subaccountCode: string = subData.data.subaccount_code;

    // 3. Persist payout details + subaccount code on the host's profile.
    const { error: updErr } = await supabase
      .from("users")
      .update({
        payout_bank: bank_name,
        payout_account_number: account_number,
        payout_account_name: resolvedName,
        paystack_subaccount_code: subaccountCode,
      })
      .eq("id", user.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      subaccount_code: subaccountCode,
      account_name: resolvedName,
    });
  } catch {
    return NextResponse.json(
      { error: "Payout setup failed. Please try again." },
      { status: 502 }
    );
  }
}
