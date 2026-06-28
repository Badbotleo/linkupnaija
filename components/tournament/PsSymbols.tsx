// Decorative PlayStation button symbols (triangle, circle, cross, square),
// scattered across the tournament hero. Purely decorative.

const COLORS = {
  triangle: "#4FD1A5",
  circle: "#F65A78",
  cross: "#5C86FF",
  square: "#E06FCB",
};

function Triangle({ s = 40 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4 21 20H3z" stroke={COLORS.triangle} strokeWidth="2" />
    </svg>
  );
}
function Circle({ s = 40 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke={COLORS.circle} strokeWidth="2" />
    </svg>
  );
}
function Cross({ s = 40 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5 19 19M19 5 5 19"
        stroke={COLORS.cross}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Square({ s = 40 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="1.5" stroke={COLORS.square} strokeWidth="2" />
    </svg>
  );
}

export default function PsSymbols() {
  // [Component, top%, left%, size, opacity]
  const items: [React.FC<{ s?: number }>, string, string, number, number][] = [
    [Triangle, "12%", "8%", 46, 0.5],
    [Circle, "22%", "84%", 52, 0.45],
    [Cross, "62%", "6%", 40, 0.4],
    [Square, "70%", "88%", 48, 0.45],
    [Circle, "82%", "16%", 30, 0.35],
    [Triangle, "40%", "92%", 28, 0.3],
    [Cross, "8%", "60%", 26, 0.3],
    [Square, "50%", "78%", 22, 0.3],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map(([Cmp, top, left, s, opacity], i) => (
        <span
          key={i}
          className="absolute"
          style={{ top, left, opacity }}
        >
          <Cmp s={s} />
        </span>
      ))}
    </div>
  );
}
