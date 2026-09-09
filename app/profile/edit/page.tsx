import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LineIcon from "@/components/ui/LineIcon";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

/**
 * Settings, as a list of rows.
 *
 * This was one page carrying five expanded cards: verify your phone, the
 * whole profile form, bank details, an emergency contact and email
 * preferences, all open at once. Changing your bank meant scrolling past your
 * bio and your Instagram handle to reach it.
 *
 * Settings is the one surface where being conventional is the entire job.
 * Nobody admires a bespoke settings screen and nobody wants to explore one:
 * they came to change one thing and leave. So it is the pattern every phone
 * already taught them, a grouped list of rows that each open their own
 * screen, and each row says what it is currently set to. A row reading "Not
 * set" is the whole reason this shape beats a wall of forms.
 */

function Row({
  href,
  icon,
  label,
  value,
  warn = false,
}: {
  href: string;
  icon: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50 dark:hover:bg-white/[0.04]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/[0.08] text-brand">
        <LineIcon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gray-900 dark:text-white">
          {label}
        </span>
        <span
          className={`block truncate text-[13px] ${
            warn ? "font-semibold text-amber-700" : "text-gray-500"
          }`}
        >
          {value}
        </span>
      </span>
      <LineIcon name="chevronRight" size={16} className="shrink-0 text-gray-400" />
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-gray-400">
        {title}
      </h2>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-[var(--e1)] dark:divide-white/10 dark:bg-white/[0.04]">
        {children}
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile/edit");

  const [{ data: profile }, { data: emailPrefs }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "name, state, bio, avatar_url, phone, phone_verified, payout_bank, payout_account_number, emergency_contact_name"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("email_preferences")
      .select("weekly_digest_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const p = profile as {
    name: string | null;
    state: string | null;
    bio: string | null;
    avatar_url: string | null;
    phone: string | null;
    phone_verified: boolean | null;
    payout_bank: string | null;
    payout_account_number: string | null;
    emergency_contact_name: string | null;
  } | null;

  // What each row is currently set to. A settings list that does not say is
  // just a menu, and you have to open every screen to find the empty one.
  const profileBits = [p?.name && "name", p?.avatar_url && "photo", p?.bio && "bio"]
    .filter(Boolean).length;

  return (
    <div>
      <AppHeader title="Settings" back />
      <div className="container-page max-w-[640px] py-4">
        <Group title="You">
          <Row
            href="/profile/edit/details"
            icon="users"
            label="Profile"
            value={
              profileBits === 3
                ? `${p?.name}${p?.state ? ` · ${p.state}` : ""}`
                : "Add your photo and bio"
            }
            warn={profileBits < 3}
          />
          <Row
            href="/profile/edit/safety"
            icon="shield"
            label="Phone and safety"
            value={
              p?.phone_verified
                ? `Verified${p?.emergency_contact_name ? " · emergency contact set" : ""}`
                : "Phone not verified"
            }
            warn={!p?.phone_verified}
          />
        </Group>

        <Group title="Money">
          <Row
            href="/profile/edit/payouts"
            icon="ticket"
            label="Payout details"
            value={
              p?.payout_bank && p?.payout_account_number
                ? `${p.payout_bank} · ${p.payout_account_number}`
                : "Not set. Needed before a payout"
            }
            warn={!p?.payout_bank}
          />
        </Group>

        <Group title="Notifications">
          <Row
            href="/profile/edit/emails"
            icon="bell"
            label="Email preferences"
            value={
              emailPrefs?.weekly_digest_enabled === false
                ? "Weekly digest off"
                : "Weekly digest on"
            }
          />
        </Group>

        <Group title="Account">
          <Row
            href={`/u/${user.id}`}
            icon="eye"
            label="View your public profile"
            value="What other members see"
          />
          <Row
            href="/refer"
            icon="gift"
            label="Invite and earn"
            value="₦600 a friend, cash out at ₦3,000"
          />
        </Group>

        <p className="mt-6 px-1 text-center text-[12px] text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </div>
  );
}
