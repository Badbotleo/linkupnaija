import { LegalShell, LegalSection, LegalList } from "@/components/legal/Legal";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How LinkUpNaija collects, uses, and protects your personal data, cookies and payment information.",
};

const UPDATED = "23 June 2026";
const CONTACT = "support@linkupnaija.com";

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={UPDATED}
      intro={`This Privacy Policy explains how LinkUpNaija ("we", "us", "our") collects, uses, shares and protects your information when you use our website and services. By using LinkUpNaija, you agree to the practices described here.`}
    >
      <LegalSection n={1} title="Information we collect">
        <p>We collect the following categories of information:</p>
        <LegalList
          items={[
            <>
              <strong>Account information</strong> — your name, email address,
              state, profile photo, bio, phone number and social media links
              (Instagram, X/Twitter, Facebook) that you choose to provide.
            </>,
            <>
              <strong>Event and RSVP data</strong> — events you host or request
              to join, your attendance status, and group-chat messages for events
              you are part of.
            </>,
            <>
              <strong>Reservation data</strong> — details you submit when
              requesting a venue reservation (event name, date, group size, event
              type, special requests and contact phone number).
            </>,
            <>
              <strong>Payment information</strong> — when you pay for a ticket or
              feature an event, payments are processed by Paystack. We receive a
              transaction reference and amount, but{" "}
              <strong>we never collect or store your full card details</strong>.
            </>,
            <>
              <strong>Reviews and ratings</strong> — ratings and reviews you leave
              for hosts after attending events.
            </>,
            <>
              <strong>Usage and device data</strong> — basic technical
              information such as your browser type and interactions needed to
              operate and secure the service.
            </>,
            <>
              <strong>Location searches</strong> — the cities or areas you search
              for when discovering venues (used to query map data).
            </>,
            <>
              <strong>AI assistant messages</strong> — messages you send to our
              in-app AI assistant, used to generate a response.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n={2} title="How we use your information">
        <LegalList
          items={[
            "To create and manage your account and profile.",
            "To operate core features — hosting events, processing join requests, group chats, venue discovery and reservations.",
            "To process payments and record platform fees and commissions.",
            "To send transactional emails such as event reminders and account notifications.",
            "To show hosts the profiles of people requesting to join their events.",
            "To display host ratings, reviews and a verification badge for users who add social links.",
            "To keep the platform safe, prevent fraud and abuse, and comply with law.",
          ]}
        />
      </LegalSection>

      <LegalSection n={3} title="Cookies and similar technologies">
        <p>
          We use essential cookies to keep you logged in and to secure your
          session. Authentication is handled by Supabase, which sets cookies that
          store your session token so you don&apos;t have to log in on every page.
        </p>
        <p>
          These cookies are necessary for the service to function. We do not use
          third-party advertising or cross-site tracking cookies. You can clear
          or block cookies in your browser settings, but doing so may prevent you
          from staying logged in.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Payments">
        <p>
          Paid event tickets and featured-event payments are handled by{" "}
          <strong>Paystack</strong>, a third-party payment processor. Your card
          and banking details are entered directly into Paystack&apos;s secure
          checkout and are governed by Paystack&apos;s own privacy policy.
        </p>
        <p>
          We record the transaction reference, amount, and a platform fee (10% of
          paid ticket sales) for accounting purposes. For venue reservations, any
          commission is agreed and recorded by LinkUpNaija before a booking is
          confirmed.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Third-party services we rely on">
        <LegalList
          items={[
            <>
              <strong>Supabase</strong> — authentication, database and file
              storage (profile photos, event cover images).
            </>,
            <>
              <strong>Paystack</strong> — payment processing.
            </>,
            <>
              <strong>Anthropic (Claude)</strong> — powers the AI assistant;
              messages you send to it are processed to generate replies.
            </>,
            <>
              <strong>Resend</strong> — delivery of reminder and notification
              emails.
            </>,
            <>
              <strong>OpenStreetMap, Overpass &amp; Nominatim</strong> — venue and
              map data for the Venues feature.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n={6} title="How we share information">
        <p>We do not sell your personal data. We share information only:</p>
        <LegalList
          items={[
            "With event hosts, who can see the profile (name, photo, state, bio and social links) of users requesting to join their events.",
            "With other attendees of an event, where your name and photo appear in attendee lists and group chats.",
            "With the service providers listed above, strictly to operate the platform.",
            "With our administrators, who manage reservations and platform operations.",
            "Where required by law, regulation, legal process, or to protect the rights and safety of our users.",
          ]}
        />
      </LegalSection>

      <LegalSection n={7} title="Data retention">
        <p>
          We keep your information for as long as your account is active or as
          needed to provide the service, comply with our legal obligations,
          resolve disputes and enforce our agreements. You may request deletion of
          your account at any time (see &quot;Your rights&quot; below).
        </p>
      </LegalSection>

      <LegalSection n={8} title="Your rights">
        <p>
          You can access and update most of your information directly from your
          profile and dashboard. You may also contact us to request access to,
          correction of, or deletion of your personal data, or to object to
          certain processing. Email us at{" "}
          <a href={`mailto:${CONTACT}`} className="text-brand hover:underline">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection n={9} title="Security">
        <p>
          We use industry-standard measures including encrypted connections,
          row-level security on our database, and scoped access controls to
          protect your data. No method of transmission or storage is 100% secure,
          but we work to protect your information and continuously improve our
          safeguards.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Children">
        <p>
          LinkUpNaija is intended for users aged 18 and over. We do not knowingly
          collect personal data from anyone under 18. If you believe a minor has
          provided us information, please contact us so we can remove it.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will revise the
          &quot;Last updated&quot; date above and, where appropriate, notify you
          in the app. Continued use of LinkUpNaija after changes means you accept
          the updated policy.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Contact us">
        <p>
          Questions about this policy or your data? Email{" "}
          <a href={`mailto:${CONTACT}`} className="text-brand hover:underline">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
