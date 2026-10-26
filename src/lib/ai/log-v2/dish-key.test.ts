import { describe, expect, it } from 'vitest';
import { normalizeDishKey } from './dish-key';

describe('normalizeDishKey', () => {
  it('treats case, accents and articles as the same dish', () => {
    const key = normalizeDishKey('arepa catira');
    expect(normalizeDishKey('Arepa Catira')).toBe(key);
    expect(normalizeDishKey('una arepa catira')).toBe(key);
    expect(normalizeDishKey('  Una   AREPA  catira ')).toBe(key);
  });

  it('removes accents', () => {
    expect(normalizeDishKey('Pabellón criollo')).toBe('pabellon criollo');
    expect(normalizeDishKey('Tortilla de Patatas')).toBe('tortilla de patatas');
  });

  it('drops leading numbers and English articles', () => {
    expect(normalizeDishKey('2 empanadas')).toBe('empanadas');
    expect(normalizeDishKey('The paella')).toBe('paella');
  });

  it('keeps articles inside the name and a single-word name', () => {
    expect(normalizeDishKey('huevos a la flamenca')).toBe('huevos a la flamenca');
    expect(normalizeDishKey('la')).toBe('la');
  });

  it('ignores punctuation', () => {
    expect(normalizeDishKey('Café, con leche!')).toBe('cafe con leche');
  });
});
