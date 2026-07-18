// Shared email helpers for all LinkUpNaija Edge Functions.
//
// One branded, cross-client HTML template (table-based, inline styles) plus a
// small Resend send wrapper, so every retention email looks consistent.

export const BRAND = "#534AB7";
export const BRAND_DARK = "#3F3893";
export const FROM =
  Deno.env.get("REMINDER_FROM") ?? "LinkUpNaija <support@linkupnaija.com>";
export const SITE_URL = (
  Deno.env.get("SITE_URL") ?? "https://linkupnaija.com"
).replace(/\/+$/, "");

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "there").trim().split(/\s+/)[0] || "there";
}

export function formatDate(date: string, time?: string | null): string {
  // date is YYYY-MM-DD; render it human-friendly without a timezone surprise.
  try {
    const d = new Date(`${date}T${time ?? "00:00"}:00`);
    const day = d.toLocaleDateString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (!time) return day;
    const t = d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${day} · ${t}`;
  } catch {
    return time ? `${date} at ${time}` : date;
  }
}

export interface EmailEvent {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  state?: string | null;
  category?: string | null;
}

/** A single event row used inside the email body. */
export function eventCardHtml(e: EmailEvent): string {
  const url = `${SITE_URL}/events/${e.id}`;
  const meta = [
    formatDate(e.date, e.time),
    [e.location, e.state].filter(Boolean).map(escapeHtml).join(", "),
  ]
    .filter(Boolean)
    .join(" &nbsp;•&nbsp; ");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">
      <tr>
        <td style="border:1px solid #ECECF3;border-radius:12px;padding:14px 16px">
          <a href="${url}" style="color:#1A1040;font-size:16px;font-weight:700;text-decoration:none">
            ${escapeHtml(e.title)}
          </a>
          <div style="color:#6B6B7B;font-size:13px;margin-top:4px">${meta}</div>
          <a href="${url}" style="color:${BRAND};font-size:13px;font-weight:600;text-decoration:none;display:inline-block;margin-top:8px">
            View event →
          </a>
        </td>
      </tr>
    </table>`;
}

export function button(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0">
      <tr>
        <td style="border-radius:10px;background:${BRAND}">
          <a href="${href}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Wrap body HTML in the branded purple shell. */
export function emailLayout(opts: {
  title: string;
  bodyHtml: string;
  preheader?: string;
  unsubscribeUrl?: string;
}): string {
  const { title, bodyHtml, preheader = "", unsubscribeUrl } = opts;
  const footer = unsubscribeUrl
    ? `You're receiving this because you have an account on LinkUpNaija.
       <a href="${unsubscribeUrl}" style="color:#9A9AA8;text-decoration:underline">Unsubscribe</a> ·
       <a href="${SITE_URL}/profile/edit" style="color:#9A9AA8;text-decoration:underline">Email preferences</a>`
    : `Sent with 💜 by LinkUpNaija`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F3FA;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FA">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND};padding:22px 28px">
              <a href="${SITE_URL}" style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;text-decoration:none">
                LinkUp<span style="color:#FAC775">Naija</span>
              </a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;background:#FAFAFE;border-top:1px solid #EEEEF5">
              <p style="margin:0;color:#9A9AA8;font-size:12px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                ${footer}
              </p>
              <p style="margin:8px 0 0;color:#C2C2CE;font-size:11px">
                © ${new Date().getFullYear()} LinkUpNaija · Nigeria
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;color:#1A1040;font-size:22px;font-weight:800;line-height:1.3">${escapeHtml(
    text
  )}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;color:#44444F;font-size:15px;line-height:1.6">${html}</p>`;
}

/** The "Welcome to LinkUpNaija" email (shared by welcome-sequence + backfill). */
export function welcomeEmailHtml(opts: {
  name: string | null;
  state: string | null;
  events: EmailEvent[];
}): string {
  const eventsBlock = opts.events.length
    ? `<p style="margin:18px 0 10px;color:#1A1040;font-size:15px;font-weight:700">
         Happening soon${opts.state ? ` in ${escapeHtml(opts.state)}` : ""} 👇
       </p>${opts.events.map(eventCardHtml).join("")}`
    : "";
  return emailLayout({
    title: "Welcome to LinkUpNaija",
    preheader: "Find your people and your next outing.",
    bodyHtml: `
      ${heading(`Welcome to LinkUpNaija, ${firstName(opts.name)}! 🎉`)}
      ${paragraph(
        "We're buzzing to have you. LinkUpNaija is where Nigerians find hangouts, parties, picnics, game nights and more, or host their own."
      )}
      ${paragraph("Here's how to get started:")}
      ${button(`${SITE_URL}/events`, "🔎 Browse events")}
      ${button(`${SITE_URL}/host`, "🎤 Host an event")}
      ${button(`${SITE_URL}/profile/edit`, "✨ Complete your profile")}
      ${eventsBlock}
    `,
  });
}

/** Send one email through Resend. Returns true on success. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not set");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from ?? FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
  }
  return res.ok;
}
