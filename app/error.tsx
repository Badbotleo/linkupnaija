"use client";

// Route-level error boundary: if any page/segment throws during render or data
// fetching, this renders instead of crashing the whole app, with a retry.
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for logging/observability.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-5xl">😕</p>
      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-gray-600">
        We hit a snag loading this page. It&apos;s usually temporary. Try again
        in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Go home
        </Link>
      </div>
    </div>
  );
}
