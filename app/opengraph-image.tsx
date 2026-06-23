import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LinkUpNaija — Nigeria's social events platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #534AB7 0%, #322C6E 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "white",
              color: "#534AB7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 900,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
            <span>LinkUp</span>
            <span style={{ color: "#DAD8F0" }}>Naija</span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 48,
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-2px",
          }}
        >
          Link up. Hang out. Vibe.
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 36,
            color: "#DAD8F0",
            maxWidth: 900,
          }}
        >
          Nigeria&apos;s social events platform — clubbing, parties, picnics,
          book clubs & more across all 36 states.
        </div>

        {/* Nigeria flag accent */}
        <div style={{ marginTop: 56, display: "flex", gap: 0 }}>
          <div style={{ width: 56, height: 16, background: "#008753" }} />
          <div style={{ width: 56, height: 16, background: "white" }} />
          <div style={{ width: 56, height: 16, background: "#008753" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
