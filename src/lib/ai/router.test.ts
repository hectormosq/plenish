import { describe, expect, it } from 'vitest';
import { keywordRoute } from './router';

const pending = { draftPending: true };

describe('keywordRoute while a meal table is pending', () => {
  it.each(['sí', 'vale, guárdalo', 'sin queso', 'sin tomate', 'eran 200 g de pollo', 'añade aguacate', 'no lo guardes', 'cancel'])(
    'treats "%s" as a reply to the table',
    (text) => expect(keywordRoute(text, pending).intent).toBe('revise'),
  );

  it.each(['con mi hermano cenamos pizza', 'no, mejor planifícame la cena', 'no, I had pasta for dinner', 'si me recomiendas algo para mañana'])(
    'does not treat "%s" as a reply to the table',
    (text) => expect(keywordRoute(text, pending).intent).not.toBe('revise'),
  );

  it('never returns revise without a pending table', () => {
    expect(keywordRoute('sí').intent).not.toBe('revise');
  });
});
