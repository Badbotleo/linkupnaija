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
      <circle cx="24" cy="24" r="22" fill="#534AB7" />
      <circle cx="24" cy="24" r="16.5" fill="#3C3489" />
      {/* Centre / top person (lavender) */}
      <circle cx="24" cy="16.5" r="4" fill="#AFA9EC" />
      <path
        d="M16.5 30c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z"
        fill="#AFA9EC"
      />
      {/* Left person (white) */}
      <circle cx="14.5" cy="23" r="3.3" fill="#FFFFFF" />
      <path
        d="M8.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z"
        fill="#FFFFFF"
      />
      {/* Right person (white) */}
      <circle cx="33.5" cy="23" r="3.3" fill="#FFFFFF" />
      <path
        d="M27.5 34.5c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative font-extrabold tracking-tight ${className}`}>
      {/* naija-flag-rule: a green–white–green hairline under the mark, so the
          flag shows up in the brand itself rather than only in a chip. */}
      <span
        aria-hidden
        className="absolute -bottom-1 left-0 right-0 flex h-[3px] overflow-hidden rounded-full opacity-90"
      >
        <span className="h-full flex-1 bg-naija" />
        <span className="h-full flex-1 bg-white" />
        <span className="h-full flex-1 bg-naija" />
      </span>
      <span className="text-[#1A1040] dark:text-white">Link</span>
      <span className="text-brand dark:text-[#7F77DD]">Up</span>
      <span className="text-[#1A1040] dark:text-white">Naija</span>
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
