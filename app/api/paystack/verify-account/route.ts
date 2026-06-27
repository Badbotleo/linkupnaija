import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Resolves a Nigerian bank account via Paystack's account-resolution API.
export async function POST(req: Request) {
  let body: { account_number?: string; bank_code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { account_number, bank_code } = body;
  if (!account_number || !bank_code) {
    return NextResponse.json(
      { error: "Account number and bank are required." },
      { status: 400 }
    );
  }

  // Trim to guard against stray whitespace/newlines pasted into env vars.
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

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        account_number
      )}&bank_code=${encodeURIComponent(bank_code)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const data = await res.json();
    if (!res.ok || !data.status) {
      const msg: string = data.message || "Could not verify account.";
      const friendly = /invalid key/i.test(msg)
        ? "Paystack rejected the API key. Check that PAYSTACK_SECRET_KEY is a valid live secret key (sk_live_…) with no extra spaces."
        : msg;
      return NextResponse.json({ error: friendly }, { status: 422 });
    }
    return NextResponse.json({ account_name: data.data.account_name });
  } catch {
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 502 }
    );
  }
}
