// Leading words that do not change which dish it is ("una arepa" = "arepa").
const LEADING_FILLERS = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'a', 'an', 'the']);

/**
 * Key used to find earlier logs of the same dish: lower-case, without accents,
 * single spaces, and without leading articles or numbers.
 */
export function normalizeDishKey(name: string): string {
  const words = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  while (words.length > 1 && (LEADING_FILLERS.has(words[0]) || /^\d+$/.test(words[0]))) {
    words.shift();
  }
  return words.join(' ');
}
