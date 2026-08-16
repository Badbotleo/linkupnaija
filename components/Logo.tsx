// The mark's geometry lives in lib/logo-svg.ts so the app, app icon,
// share cards and QR codes can never disagree about it.
import { MARK } from "@/lib/logo-svg";

// LinkUpNaija pin-mark logo: a purple emblem with three "people", plus the
// wordmark. Works on light and dark backgrounds.

export function LogoMark({
  size = 32,
  pulse = false,
}: {
  size?: number;
  pulse?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={pulse ? "animate-logo-pulse" : undefined}
      style={{ transformOrigin: "center" }}
    >
      <circle {...MARK.outer} />
      <circle {...MARK.inner} />
      {/* Centre figure sits behind so the flanking two overlap it. */}
      <circle {...MARK.centreHead} />
      <path {...MARK.centreBody} />
      <circle {...MARK.leftHead} />
      <path {...MARK.leftBody} />
      <circle {...MARK.rightHead} />
      <path {...MARK.rightBody} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-[#121212] dark:text-white">Link</span>
      <span className="text-brand dark:text-[#7F77DD]">Up</span>
      <span className="text-[#121212] dark:text-white">Naija</span>
    </span>
  );
}

export default function Logo({
  size = 32,
  textClassName = "text-lg",
  pulse = false,
}: {
  size?: number;
  textClassName?: string;
  pulse?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} pulse={pulse} />
      <Wordmark className={textClassName} />
    </span>
  );
}
