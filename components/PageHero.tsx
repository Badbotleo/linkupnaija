import LineIcon from "./ui/LineIcon";

// Branded page header. The generic version of this is a coloured rectangle with
// a title in it — what keeps this one specific is structure: a gold rule and
// eyebrow, a headline, optional real numbers for THIS page, and a big ghosted
// glyph that bleeds off the right edge so no two pages look interchangeable.
export default function PageHero({
  chip,
  eyebrow,
  title,
  subtitle,
  watermark,
  icon,
  stats,
  children,
}: {
  chip?: React.ReactNode;
  /** Small uppercase label above the title, preceded by a gold rule. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Big ghost word bleeding off the right edge, e.g. "EVENTS". */
  watermark?: string;
  /** LineIcon name rendered as a large translucent glyph. */
  icon?: string;
  /** Real figures for this page — the strongest cure for a generic header. */
  stats?: { value: React.ReactNode; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(150deg, #110F25 0%, #1A1040 60%, #221E49 100%)" }}
    >
      {/* Texture + glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#534AB7]/30 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#FAC775]/15 blur-[100px]"
      />

      {/* Oversized ghost word, cropped by the section edge */}
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 bottom-[-1.5rem] select-none text-[7rem] font-black uppercase leading-none tracking-tighter text-transparent sm:-right-10 sm:text-[12rem]"
          style={{ WebkitTextStroke: "1px rgba(255,255,255,0.085)" }}
        >
          {watermark}
        </span>
      )}

      {/* Large translucent glyph */}
      {icon && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 text-white/[0.07] lg:block"
        >
          <LineIcon name={icon} size={190} />
        </span>
      )}

      <div className="container-page relative py-10 sm:py-14">
        {chip && (
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {chip}
          </span>
        )}

        {eyebrow && (
          <p className="mb-3 flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#FAC775]">
            <span aria-hidden className="h-px w-7 bg-[#FAC775]/70" />
            {eyebrow}
          </p>
        )}

        {/* Gold rule down the left of the text block — the signature mark */}
        <div className="border-l-2 border-[#FAC775]/80 pl-4 sm:pl-5">
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-[2.75rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2.5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-extrabold leading-none tracking-tight text-white tabular-nums">
                  {s.value}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>

      {/* Gold hairline instead of a hard bottom edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(250,199,117,0.55) 35%, rgba(250,199,117,0.15) 70%, transparent)",
        }}
      />
    </section>
  );
}

/** Gold-accent helper for a word inside a PageHero title. */
export function Gold({ children }: { children: React.ReactNode }) {
  return <span className="text-[#FAC775]">{children}</span>;
}
