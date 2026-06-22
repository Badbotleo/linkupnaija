import Link from "next/link";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email;

  return (
    <div className="container-page flex max-w-md flex-col py-16 text-center">
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-card">
        <p className="text-5xl">📬</p>
        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">
          Check your email
        </h1>
        <p className="mt-3 text-gray-600">
          We&apos;ve sent a verification link
          {email ? (
            <>
              {" "}
              to <span className="font-semibold text-gray-900">{email}</span>
            </>
          ) : null}
          . Click the link in that email to verify your account, then come back
          and log in.
        </p>

        <div className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand">
          You won&apos;t be able to log in until your email is verified.
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand hover:underline"
          >
            try signing up again
          </Link>
          .
        </p>

        <Link href="/login" className="btn-primary mt-6 w-full">
          Go to login
        </Link>
      </div>
    </div>
  );
}
