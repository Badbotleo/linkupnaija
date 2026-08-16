import BrandIcon from "../ui/BrandIcon";

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
    { href: instagram, label: "Instagram", icon: "instagram" },
    { href: twitter, label: "X", icon: "x" },
    { href: facebook, label: "Facebook", icon: "facebook" },
  ]
    // Only real links. A half-typed handle in the profile shouldn't become a
    // broken link on somebody else's event page. Mapping after the filter
    // rather than using a predicate keeps href a plain string.
    .filter((l) => typeof l.href === "string" && /^https?:\/\/\S+$/i.test(l.href.trim()))
    .map((l) => ({ href: l.href as string, label: l.label, icon: l.icon }));

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
          <BrandIcon name={l.icon} size={12} />
          {l.label}
        </a>
      ))}
    </div>
  );
}
