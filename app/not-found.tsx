import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-6xl">🤔</p>
      <h1 className="mt-4 text-3xl font-extrabold text-gray-900">
        Page not found
      </h1>
      <p className="mt-2 text-gray-600">
        That link-up doesn&apos;t exist or has ended.
      </p>
      <Link href="/events" className="btn-primary mt-8">
        Browse events
      </Link>
    </div>
  );
}
