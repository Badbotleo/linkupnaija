import Link from "next/link";

export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: {updated}</p>
      <p className="mt-5 leading-relaxed text-gray-600">{intro}</p>

      <div className="mt-10 space-y-9">{children}</div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-gray-100 pt-6 text-sm">
        <Link href="/privacy-policy" className="font-medium text-brand hover:underline">
          Privacy Policy
        </Link>
        <Link
          href="/terms-of-service"
          className="font-medium text-brand hover:underline"
        >
          Terms of Service
        </Link>
      </div>

      <p className="mt-6 rounded-xl bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-400">
        This document is provided for general information and does not constitute
        legal advice. LinkUpNaija recommends reviewing it with a qualified legal
        professional before relying on it in production.
      </p>
    </div>
  );
}

export function LegalSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
