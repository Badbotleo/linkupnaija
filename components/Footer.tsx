import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-black text-white">
            L
          </span>
          <span className="font-bold text-gray-900">
            LinkUp<span className="text-brand">Naija</span>
          </span>
        </div>
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
          <Link href="/pro" className="font-semibold text-amber-600 hover:text-amber-700">
            Pro
          </Link>
          <Link href="/privacy-policy" className="hover:text-brand">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-brand">
            Terms of Service
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} LinkUpNaija. Made with 💜 in Nigeria.
        </p>
      </div>
    </footer>
  );
}
