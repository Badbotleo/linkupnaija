// Paystack inline (popup) helper. Loads the script on demand and resolves
// with the transaction reference on success, or null if the user closes it.

interface PaystackHandler {
  openIframe: () => void;
}

interface PaystackPop {
  setup: (options: {
    key: string;
    email: string;
    amount: number; // in kobo
    currency?: string;
    ref?: string;
    subaccount?: string;
    transaction_charge?: number; // in kobo, to the main account
    bearer?: string;
    metadata?: Record<string, unknown>;
    callback: (response: { reference: string }) => void;
    onClose: () => void;
  }) => PaystackHandler;
}

declare global {
  interface Window {
    PaystackPop?: PaystackPop;
  }
}

function loadPaystack(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Paystack can only run in the browser"));
      return;
    }
    if (window.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      "paystack-inline-js"
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Paystack"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(script);
  });
}

export function isPaystackConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
}

/**
 * Opens the Paystack popup. Resolves with { reference } on success,
 * or null if the user closed the popup without paying.
 */
export async function payWithPaystack(opts: {
  email: string;
  amountNaira: number;
  metadata?: Record<string, unknown>;
  subaccount?: string; // host's Paystack subaccount for split payments
  /**
   * Naira to route to the main account on this one charge, overriding the
   * subaccount's stored percentage.
   *
   * Every subaccount is created at the standard 90/10 and left there. Pro's
   * half fee is applied per transaction instead, so a lapsed subscription
   * needs no Paystack call to undo it — there is nothing to undo. Passing it
   * on every split also keeps the gateway and our ledger to the naira, rather
   * than trusting two different roundings to agree.
   */
  platformFeeNaira?: number;
}): Promise<{ reference: string } | null> {
  const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!key) {
    throw new Error(
      "Payments are not configured — set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY."
    );
  }
  await loadPaystack();

  return new Promise((resolve, reject) => {
    if (!window.PaystackPop) {
      reject(new Error("Paystack failed to initialise"));
      return;
    }
    const handler = window.PaystackPop.setup({
      key,
      email: opts.email,
      amount: Math.round(opts.amountNaira * 100), // Naira → kobo
      currency: "NGN",
      // When a subaccount is set, Paystack splits the charge. transaction_charge
      // names our cut exactly, in kobo, and the subaccount receives the rest;
      // without it Paystack falls back to the subaccount's own percentage.
      // "bearer: account" makes the platform bear Paystack's own fees.
      ...(opts.subaccount
        ? {
            subaccount: opts.subaccount,
            bearer: "account",
            ...(opts.platformFeeNaira != null
              ? { transaction_charge: Math.round(opts.platformFeeNaira * 100) }
              : {}),
          }
        : {}),
      metadata: opts.metadata ?? {},
      callback: (response) => resolve({ reference: response.reference }),
      onClose: () => resolve(null),
    });
    handler.openIframe();
  });
}

// Format a Naira amount for display, e.g. 5000 → "₦5,000".
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
