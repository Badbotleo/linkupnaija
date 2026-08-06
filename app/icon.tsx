import { ImageResponse } from "next/og";
import { LOGO_MARK_DATA_URI } from "@/lib/logo-svg";

export const runtime = "nodejs";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * The app icon, generated from the real mark rather than a hand-exported PNG
 * that drifts the next time the logo changes.
 *
 * 512 because that's what Android's installer wants for the home screen; the
 * browser scales it down for the tab.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1A1040",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_MARK_DATA_URI} alt="" width={360} height={360} />
      </div>
    ),
    size
  );
}
