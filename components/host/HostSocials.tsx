import LineIcon from "../ui/LineIcon";

/**
 * A host's socials, on the page where somebody decides to join.
 *
 * They were stored on the profile and shown nowhere near the decision. A
 * first-time guest handing over money and turning up at an address is mostly
 * asking "is this person real?", and a live Instagram answers that faster
 * than any badge we could invent.
 *
 * Renders nothing when a host has none — an empty row of icons says the
 * opposite of what it's for.
 */
export default function HostSocials({
  instagram,
  twitter,
  facebook,
}: {
  instagram?: string | null;
  twitter?: string | null;
  facebook?: string | null;
}) {
  const links = [
    { href: instagram, label: "Instagram" },
    { href: twitter, label: "X" },
    { href: facebook, label: "Facebook" },
  ].filter((l): l is { href: string; label: string } =>
    // Only real links. A half-typed handle in the profile shouldn't become a
    // broken link on somebody else's event page.
    typeof l.href === "string" && /^https?:\/\/\S+$/i.test(l.href.trim())
  );

  if (links.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 transition hover:border-brand/40 hover:text-brand"
        >
          {l.label}
          <LineIcon name="share" size={10} />
        </a>
      ))}
    </div>
  );
}
