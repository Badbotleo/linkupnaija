import { appIcon } from "@/lib/appIcon";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon ("Add to Home Screen") — Next links it automatically.
export default function AppleIcon() {
  return appIcon(180);
}
