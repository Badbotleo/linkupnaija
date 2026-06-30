import Link from "next/link";
import Logo from "./Logo";

const SOCIALS = [
  {
    label: "Instagram",
    handle: "@Makewelinkupnaija",
    href: "https://instagram.com/Makewelinkupnaija",
    icon: <InstagramIcon />,
  },
  {
    label: "X (Twitter)",
    handle: "@LinkUp_Naija",
    href: "https://x.com/LinkUp_Naija",
    icon: <XIcon />,
  },
  {
    label: "TikTok",
    handle: "@LinkUpNaija",
    href: "https://tiktok.com/@linkupnaija",
    icon: <TikTokIcon />,
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="container-page py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand + contact */}
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo size={28} textClassName="text-base" />
            <a
              href="mailto:support@linkupnaija.com"
              className="text-sm text-gray-500 hover:text-brand"
            >
              support@linkupnaija.com
            </a>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
            <Link href="/events" className="hover:text-brand">
              Explore
            </Link>
            <Link href="/venues" className="hover:text-brand">
              Venues
            </Link>
            <Link href="/host" className="hover:text-brand">
              Host an event
            </Link>
            <Link href="/opportunities" className="hover:text-brand">
              Opportunities
            </Link>
            <Link
              href="/pro"
              className="font-semibold text-amber-600 hover:text-amber-700"
            >
              Pro
            </Link>
            <Link href="/privacy-policy" className="hover:text-brand">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-brand">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Follow us + copyright */}
        <div className="mt-8 flex flex-col items-center gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Follow us
            </span>
            <div className="flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} — ${s.handle}`}
                  title={s.handle}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-brand hover:text-brand"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} LinkUpNaija. Made with 💜 in Nigeria.
          </p>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.6 3.6 0 00-.88-1.35 3.6 3.6 0 00-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.59-.07-4.74-.07zm0 2.76a5.3 5.3 0 110 10.6 5.3 5.3 0 010-10.6zm0 1.62a3.68 3.68 0 100 7.36 3.68 3.68 0 000-7.36zm5.5-.93a1.24 1.24 0 110 2.48 1.24 1.24 0 010-2.48z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82a4.28 4.28 0 01-1.01-2.82h-3.3v12.96a2.59 2.59 0 01-2.59 2.46 2.59 2.59 0 01-2.59-2.59 2.59 2.59 0 012.59-2.59c.27 0 .53.04.78.12V9.97a5.9 5.9 0 00-.78-.05A5.9 5.9 0 003.8 15.83a5.9 5.9 0 005.9 5.9 5.9 5.9 0 005.9-5.9V9.01a7.55 7.55 0 004.4 1.41V7.12a4.28 4.28 0 01-3.4-1.3z" />
    </svg>
  );
}
