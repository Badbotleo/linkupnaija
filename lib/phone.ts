/**
 * Nigerian phone numbers: normalising and format-checking.
 *
 * READ THIS BEFORE USING IT FOR ANYTHING THAT MATTERS.
 *
 * Nothing here verifies that anybody owns a number. That is not possible
 * without sending something to the phone and having it come back — there is no
 * client-side trick and no free API that does it. What this does is reject
 * numbers that cannot exist: wrong length, wrong shape, a network code no
 * Nigerian carrier has ever been assigned.
 *
 * So it stops typos and lazy junk ("08012345678" typed as "0801234567"), and
 * it does NOT stop someone entering a friend's number or a plausible number
 * they made up. Anywhere the distinction matters — money, hosting — gate on
 * `users.phone_verified`, which only the OTP flow can set.
 */

/**
 * Assigned mobile network codes, as published by the NCC.
 *
 * Kept as data rather than a loose /0[789]\d{9}/ because the loose version
 * accepts 0700, 0900 and other unassigned ranges, which are exactly the
 * shapes an invented number takes.
 */
const NETWORK_CODES: Record<string, string> = {
  // MTN
  "0803": "MTN", "0806": "MTN", "0703": "MTN", "0706": "MTN",
  "0813": "MTN", "0816": "MTN", "0810": "MTN", "0814": "MTN",
  "0903": "MTN", "0906": "MTN", "0913": "MTN", "0916": "MTN",
  "0704": "MTN",
  // Airtel
  "0802": "Airtel", "0808": "Airtel", "0708": "Airtel", "0812": "Airtel",
  "0701": "Airtel", "0902": "Airtel", "0901": "Airtel", "0904": "Airtel",
  "0907": "Airtel", "0912": "Airtel", "0911": "Airtel",
  // Glo
  "0805": "Glo", "0807": "Glo", "0705": "Glo", "0815": "Glo",
  "0811": "Glo", "0905": "Glo", "0915": "Glo",
  // 9mobile
  "0809": "9mobile", "0818": "9mobile", "0817": "9mobile",
  "0909": "9mobile", "0908": "9mobile",
};

export interface PhoneCheck {
  ok: boolean;
  /** Canonical +234XXXXXXXXXX, only when ok. */
  e164?: string;
  /** Local 0XXXXXXXXXX, only when ok. */
  local?: string;
  carrier?: string;
  error?: string;
}

/**
 * Normalise and format-check a Nigerian mobile number.
 *
 * Accepts the shapes people actually type: 0803…, 803…, 234803…, +234 803…,
 * with spaces, dashes or brackets anywhere.
 */
export function checkNigerianPhone(input: string | null | undefined): PhoneCheck {
  const raw = (input ?? "").replace(/[^\d+]/g, "");
  if (!raw) return { ok: false, error: "Enter your phone number." };

  // Reduce every accepted shape to the local 0XXXXXXXXXX form.
  let local: string;
  if (raw.startsWith("+234")) local = "0" + raw.slice(4);
  else if (raw.startsWith("234")) local = "0" + raw.slice(3);
  else if (raw.startsWith("0")) local = raw;
  else if (raw.length === 10) local = "0" + raw; // typed without the leading 0
  else local = raw;

  if (!/^\d{11}$/.test(local)) {
    return {
      ok: false,
      error:
        local.length < 11
          ? "That number is too short — Nigerian numbers have 11 digits."
          : "That number is too long — Nigerian numbers have 11 digits.",
    };
  }

  const carrier = NETWORK_CODES[local.slice(0, 4)];
  if (!carrier) {
    return {
      ok: false,
      error: `${local.slice(0, 4)} isn't a Nigerian network code. Check the number.`,
    };
  }

  return { ok: true, local, e164: "+234" + local.slice(1), carrier };
}

/** Convenience for form-level checks. Returns an error message, or null. */
export function phoneError(input: string | null | undefined): string | null {
  const r = checkNigerianPhone(input);
  return r.ok ? null : (r.error ?? "That doesn't look like a Nigerian number.");
}
