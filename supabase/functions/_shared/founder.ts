// The founder introduction email — a one-time personal "hello" from Leo.
// Shared so both the existing-user backfill and the new-user (day-after-welcome)
// step render exactly the same message.

import {
  emailLayout,
  heading,
  paragraph,
  button,
  firstName,
  escapeHtml,
  SITE_URL,
} from "./email.ts";

export const FOUNDER_SUBJECT = "A quick hello from Leo, founder of LinkUpNaija 👋";
export const FOUNDER_CONTACT = "divine@divinegabriel.dev";

function tip(emoji: string, title: string, text: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">
      <tr>
        <td style="border:1px solid #ECECF3;border-radius:12px;padding:12px 14px">
          <div style="color:#1A1040;font-size:15px;font-weight:700">${emoji} ${escapeHtml(title)}</div>
          <div style="color:#44444F;font-size:14px;line-height:1.55;margin-top:3px">${text}</div>
        </td>
      </tr>
    </table>`;
}

export function founderEmailHtml(opts: {
  name: string | null;
  unsubscribeUrl?: string;
}): string {
  const tips =
    tip(
      "🙌",
      "Complete your profile",
      `A photo and a line about you help others feel comfortable saying yes. <a href="${SITE_URL}/profile/edit" style="color:#534AB7;font-weight:600;text-decoration:none">Finish yours →</a>`
    ) +
    tip(
      "⭕",
      "Join a Circle",
      `Find your people around a shared interest and never miss a link-up. <a href="${SITE_URL}/circles" style="color:#534AB7;font-weight:600;text-decoration:none">Explore Circles →</a>`
    ) +
    tip(
      "🎤",
      "Host your first hangout",
      `A picnic, game night or small party — it takes two minutes to set up. <a href="${SITE_URL}/host" style="color:#534AB7;font-weight:600;text-decoration:none">Host one →</a>`
    ) +
    tip(
      "🛡️",
      "Link up safely",
      "Hosts approve every attendee and profiles are verified — meet in public, tell a friend, and trust your gut."
    );

  return emailLayout({
    title: "A hello from the founder",
    preheader: "Why I built LinkUpNaija — and how to get the most from it.",
    unsubscribeUrl: opts.unsubscribeUrl,
    bodyHtml: `
      ${heading(`Hi ${firstName(opts.name)}, I'm Leo 👋`)}
      ${paragraph(
        "I'm Divine Gabriel — everyone calls me Leo — the founder of LinkUpNaija. I wanted to say hello personally and thank you for joining."
      )}
      ${paragraph(
        "I built LinkUpNaija out of frustration: boring weekends, endless scrolling, and plans that fizzled out before anyone actually met up. I figured if I was tired of it, plenty of others were too — so I decided to fix it."
      )}
      ${paragraph(
        "The whole point is <strong>real connection</strong> — getting people off their screens and meeting in real life. That's it. Everything here is built to help you find your people and actually show up."
      )}
      ${paragraph("A few things that'll help you get started:")}
      ${tips}
      ${paragraph(
        `I read every reply, so if you have an idea, a problem, or just want to say hi, email me directly at <a href="mailto:${FOUNDER_CONTACT}" style="color:#534AB7;font-weight:600;text-decoration:none">${FOUNDER_CONTACT}</a>.`
      )}
      ${button(`${SITE_URL}/events`, "🔎 Find your first link-up")}
      ${paragraph(
        "See you out there,<br/><strong>Leo</strong><br/><span style=\"color:#6B6B7B;font-size:14px\">Divine Gabriel · Founder, LinkUpNaija</span>"
      )}
    `,
  });
}
