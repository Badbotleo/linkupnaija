import { appIcon } from "@/lib/appIcon";

export const runtime = "edge";

// 512×512 PWA icon referenced by app/manifest.ts (also used as maskable).
export function GET() {
  return appIcon(512);
}
