// Branded page header: deep-navy color block with glows, a dot-grid texture
// and a giant outlined watermark word, so each page opens with an editorial
// brand moment instead of a plain title bar.
export default function PageHero({
  chip,
  title,
  subtitle,
  watermark,
  children,
}: {
  chip?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Big ghost word behind the title, e.g. "EVENTS". */
  watermark?: string;
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
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-4 right-0 select-none text-[5.5rem] font-black uppercase leading-none tracking-tighter text-transparent sm:text-[8rem]"
          style={{ WebkitTextStroke: "1px rgba(255,255,255,0.09)" }}
        >
          {watermark}
        </span>
      )}

      <div className="container-page relative py-10 sm:py-14">
        {chip && (
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {chip}
          </span>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/** Gold-accent helper for a word inside a PageHero title. */
export function Gold({ children }: { children: React.ReactNode }) {
  return <span className="text-[#FAC775]">{children}</span>;
}
