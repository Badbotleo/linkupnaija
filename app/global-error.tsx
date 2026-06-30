"use client";

// Catches errors thrown in the root layout itself (where the route-level
// error.tsx can't help). Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#555" }}>
          Please refresh the page or try again shortly.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            background: "#534AB7",
            color: "white",
            border: "none",
            borderRadius: "0.75rem",
            padding: "0.625rem 1.25rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
