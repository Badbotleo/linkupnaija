import type { Metadata } from "next";
import DeleteAccountPanel from "@/components/account/DeleteAccountPanel";

/**
 * The account deletion page.
 *
 * This URL is what goes into Play Console's Data safety form, which is why it
 * is a normal public page rather than something behind the app: Google checks
 * that a person who has already uninstalled, or who never installed, can still
 * reach it and see what deletion does before they are asked to sign in.
 *
 * So the explanation is readable signed out, and only the button needs a
 * session.
 */
export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "Delete your LinkUpNaija account and the personal data we hold about you, and see exactly what is removed and what is kept.",
};

const CONTACT = "support@linkupnaija.com";

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
        Delete your account
      </h1>
      <p className="mt-3 text-gray-600">
        You can delete your LinkUpNaija account at any time, from here or from
        Profile &rarr; Settings in the app. It takes effect immediately. There is
        no waiting period and nothing to email us about.
      </p>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-extrabold text-gray-900">What is deleted</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {[
            "Your name, email address, phone number and profile photos",
            "Your bio, interests, state and social media links",
            "Your bank details and payout account",
            "Your emergency contacts",
            "Your saved connections and who has viewed your profile",
            "Every notification and email subscription we hold for you",
            "Your login. You will be signed out and will not be able to sign back in",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
              />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-extrabold text-gray-900">What is kept, and why</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {[
            "Records of tickets bought and payments made, with you detached from them. Hosts need an accurate record of who paid them, and we are required to keep financial records.",
            "Events you hosted, so that people holding tickets to them keep their tickets. Your name is removed and you appear as a deleted member.",
            "Posts and messages you wrote, shown without your name. Deleting them would leave holes in other people's conversations.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400"
              />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          None of what is kept identifies you. If you would rather a specific
          post or message were removed as well, email{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          and we will take it down.
        </p>
      </section>

      <DeleteAccountPanel />

      <p className="mt-8 text-xs text-gray-500">
        Paystack keeps its own record of any payment you made, which we cannot
        delete and are not permitted to. That record is held under Paystack&apos;s
        own privacy policy.
      </p>
    </main>
  );
}
