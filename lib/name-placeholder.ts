/**
 * The example name in the "your name" field.
 *
 * It was "Chidi Okeke" everywhere — a good name, and Igbo, on a platform for
 * all of Nigeria. A single example in a signup form quietly says who the site
 * expects, and the one place you don't want that is the field where somebody
 * types their own name.
 *
 * So it rotates across the country. Yoruba, Hausa/Fulani, Igbo, Efik,
 * Tiv, Edo, Ijaw, Kanuri and Nupe, in no ranked order.
 */
export const NAME_PLACEHOLDERS = [
  "Adebayo Ogunlesi",
  "Amina Bello",
  "Chidi Okeke",
  "Emem Udoh",
  "Terwase Iorkyaa",
  "Osaze Igbinedion",
  "Boma Briggs",
  "Falmata Kolo",
  "Ndagi Baba",
  "Yetunde Alabi",
  "Hauwa Danjuma",
  "Ifeoma Nwachukwu",
] as const;

/**
 * Index 0 on the server, a random one after mount.
 *
 * Picking randomly during render would differ between the server pass and the
 * client pass and trip React's hydration check — a real error in the console
 * over a placeholder. Callers set this in an effect instead.
 */
export const DEFAULT_NAME_PLACEHOLDER = NAME_PLACEHOLDERS[0];

export function randomNamePlaceholder(): string {
  return NAME_PLACEHOLDERS[Math.floor(Math.random() * NAME_PLACEHOLDERS.length)];
}
