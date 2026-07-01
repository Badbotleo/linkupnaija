// LinkUpNaija — corporate inquiry emails.
//
// Invoked after a /corporate quote submission:
//   supabase.functions.invoke("send-corporate-inquiry", { body: { id } })
// Sends a confirmation to the company contact and an alert to the LinkUpNaija
// team. (The in-app admin notification is handled by a DB trigger.)
//
// Deploy: supabase functions deploy send-corporate-inquiry

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FROM,
  emailLayout,
  heading,
  paragraph,
  button,
  escapeHtml,
  firstName,
  sendEmail,
  SITE_ORIGIN,
} from "../_shared/email.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let id: string | undefined;
  try {
    id = (await req.json()).id;
  } catch {
    /* ignore */
  }
  if (!id) return json({ error: "id required" }, 400);

  const { data: acc } = await supabase
    .from("corporate_accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (!acc?.email) return json({ error: "not found" }, 404);

  // 1) Confirmation to the company contact.
  const confirmation = emailLayout({
    title: "We received your request",
    preheader: "The LinkUpNaija team will be in touch shortly.",
    bodyHtml: `
      ${heading(`Thanks, ${escapeHtml(firstName(acc.contact_name))}! 🏢`)}
      ${paragraph(
        `We've received your corporate event request for <strong>${escapeHtml(acc.company_name)}</strong>. Our team will reach out within one business day with a tailored proposal.`
      )}
      ${paragraph("In the meantime, explore what's possible:")}
      ${button(`${SITE_ORIGIN}/corporate`, "View corporate plans")}
    `,
  });
  const sentContact = await sendEmail({
    to: acc.email,
    subject: "Your LinkUpNaija corporate event request",
    html: confirmation,
  });

  // 2) Alert to the LinkUpNaija team.
  const adminTo = Deno.env.get("ADMIN_EMAIL") ?? "support@linkupnaija.com";
  const details = [
    ["Company", acc.company_name],
    ["Contact", acc.contact_name],
    ["Email", acc.email],
    ["Phone", acc.phone],
    ["Industry", acc.industry],
    ["Company size", acc.company_size],
    ["State", acc.state],
    ["Plan", acc.plan],
    ["Event type", acc.event_type],
    ["Attendees", acc.attendees],
    ["Date range", acc.date_range],
    ["Budget", acc.budget_range],
    ["Requirements", acc.requirements],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 10px 4px 0;color:#6B6B7B">${k}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(String(v))}</td></tr>`
    )
    .join("");
  await sendEmail({
    from: FROM,
    to: adminTo,
    subject: `🏢 New corporate inquiry — ${acc.company_name}`,
    html: emailLayout({
      title: "New corporate inquiry",
      bodyHtml: `${heading("New corporate inquiry")}<table>${details}</table>`,
    }),
  });

  return json({ confirmation: sentContact });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
