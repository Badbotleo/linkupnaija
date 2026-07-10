import { appIcon } from "@/lib/appIcon";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon — Next links it automatically.
export default function Icon() {
  return appIcon(64);
}
