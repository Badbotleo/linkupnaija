import { appIcon } from "@/lib/appIcon";

export const runtime = "edge";

// 192×192 PWA icon referenced by app/manifest.ts.
export function GET() {
  return appIcon(192);
}
