import NaijaFlag from "./NaijaFlag";

/**
 * A category's emoji, with the one exception that can't be typed.
 *
 * 🇳🇬 is a regional-indicator pair, not a character. When a font has no glyph
 * for the pair the platform falls back to drawing the letters — and that
 * fallback inherits `color`, so on a dark background the white stripe turns
 * whatever the text colour is. It looked black. NaijaFlag draws it instead.
 *
 * This lives in its own component because the chip rule now applies in two
 * places: the badge on a card, and the category strip on the visitor home
 * page, which reaches into CATEGORY_STYLES directly. A third caller getting
 * it wrong is exactly how the first one was missed.
 */
export default function CategoryEmoji({
  emoji,
  size = 12,
}: {
  emoji?: string;
  size?: number;
}) {
  if (!emoji) return null;
  if (emoji === "🇳🇬") return <NaijaFlag size={size} />;
  return <span aria-hidden>{emoji}</span>;
}
