import { LegalShell, LegalSection, LegalList } from "@/components/legal/Legal";

export const metadata = {
  title: "Terms of Service",
  description:
    "The rules for using LinkUpNaija: accounts, events, venue reservations, payments, fees and acceptable conduct.",
};

const UPDATED = "23 June 2026";
const CONTACT = "support@linkupnaija.com";

export default function TermsOfServicePage() {
  return (
    <LegalShell
      title="Terms of Service"
      updated={UPDATED}
      intro={`These Terms of Service ("Terms") govern your access to and use of LinkUpNaija. By creating an account or using the platform, you agree to these Terms. If you do not agree, please do not use LinkUpNaija.`}
    >
      <LegalSection n={1} title="Eligibility">
        <p>
          You must be at least 18 years old and able to form a binding contract
          to use LinkUpNaija. By using the service you confirm that you meet these
          requirements and that the information you provide is accurate.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Your account">
        <LegalList
          items={[
            "You are responsible for keeping your login credentials secure and for all activity under your account.",
            "You agree to provide accurate, current information and to keep your profile up to date.",
            "You may sign in with email and password or with Google. You are responsible for the security of any connected account.",
            "Notify us immediately of any unauthorised use of your account.",
          ]}
        />
      </LegalSection>

      <LegalSection n={3} title="Hosting and attending events">
        <LegalList
          items={[
            "Hosts are solely responsible for the events they create, including accuracy of details, safety, legality and conduct at the event.",
            "Joining an event is a request, not a guarantee. Hosts review and may accept or decline requests at their discretion.",
            "Accepted attendees gain access to the event's private group chat. Use it respectfully.",
            "LinkUpNaija is a platform to connect people; we are not the organiser of, and are not responsible for, any user-hosted event.",
          ]}
        />
      </LegalSection>

      <LegalSection n={4} title="Venues and reservations">
        <p>
          The Venues feature uses open data from OpenStreetMap to help you
          discover places. Venue information is provided &quot;as is&quot; and may
          be incomplete or inaccurate. When you submit a reservation request,
          LinkUpNaija facilitates the request and aims to confirm within 24 hours.
        </p>
        <p>
          A reservation is only confirmed once LinkUpNaija marks it as confirmed.
          We are not the venue operator and do not guarantee availability,
          pricing or the quality of any third-party venue or its services.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Payments, fees and refunds">
        <LegalList
          items={[
            "Hosts may set a ticket price for an event. Where a price is set, attendees must complete payment via Paystack before their join request is submitted.",
            "LinkUpNaija charges a platform fee of 10% on paid ticket sales.",
            "Hosts may pay ₦5,000 to boost an event for 48 hours; boosted events appear at the top of the feed with a Boost badge. Boost payments are non-refundable.",
            "For confirmed venue reservations, an agreed commission may apply, shown before confirmation.",
            "Payments are processed by Paystack and are subject to its terms. Refunds, where applicable, are handled on a case-by-case basis. Contact us with your transaction reference.",
            "You are responsible for any taxes applicable to amounts you earn as a host.",
          ]}
        />
      </LegalSection>

      <LegalSection n={6} title="Acceptable use and platform rules">
        <p>You agree that you will not:</p>
        <LegalList
          items={[
            "Use the platform for any unlawful purpose or to organise illegal, unsafe or harmful activities.",
            "Post false, misleading, fraudulent or scam event or venue listings.",
            "Harass, threaten, defame or discriminate against other users.",
            "Collect money for events you do not intend to host, or otherwise defraud attendees.",
            "Post spam, malware, or content that infringes others' rights.",
            "Impersonate any person or misrepresent your affiliation with anyone.",
            "Attempt to disrupt, reverse-engineer, scrape or gain unauthorised access to the platform.",
          ]}
        />
        <p>
          We may remove content and suspend or terminate accounts that violate
          these rules.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Your content, reviews and ratings">
        <p>
          You retain ownership of the content you post (event details, photos,
          reviews, messages). By posting, you grant LinkUpNaija a non-exclusive,
          worldwide licence to host and display that content for the purpose of
          operating the service.
        </p>
        <p>
          Reviews and ratings must reflect genuine experiences. Fake, incentivised
          or abusive reviews are prohibited and may be removed.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Intellectual property">
        <p>
          The LinkUpNaija name, logo, and the platform&apos;s design and software
          are owned by LinkUpNaija and protected by applicable laws. Map data is
          © OpenStreetMap contributors and used under the Open Database License.
          You may not use our branding without permission.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Disclaimers">
        <p>
          LinkUpNaija is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis without warranties of any kind. We do not warrant
          that the service will be uninterrupted or error-free, or that venue and
          event information is accurate. You attend events and interact with other
          users at your own risk.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, LinkUpNaija and its team are not
          liable for any indirect, incidental, special or consequential damages,
          or for the conduct of any user, host, attendee or venue, arising from
          your use of the platform.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Termination">
        <p>
          You may stop using LinkUpNaija and request account deletion at any time.
          We may suspend or terminate your access if you breach these Terms or use
          the platform in a way that harms others or the service.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Governing law">
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria.
          Any disputes will be subject to the jurisdiction of the Nigerian courts.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. We will update the
          &quot;Last updated&quot; date and, where appropriate, notify you in the
          app. Continued use after changes means you accept the revised Terms.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Contact us">
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${CONTACT}`} className="text-brand hover:underline">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
