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
