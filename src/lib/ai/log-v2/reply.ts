import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { MealDraft } from './schemas';

// Template replies of the v2 pipeline — no model call, translated (research R1, R9).

export type PipelineOutcome = 'saved' | 'draft' | 'question' | 'error';

function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long' });
}

export function buildReply(
  outcome: PipelineOutcome,
  draft: MealDraft | null,
  lang: Lang,
  askAbout?: string,
): string {
  switch (outcome) {
    case 'saved': {
      const mealType = draft ? t(lang, `mealType.${draft.meal_type}`) : '';
      // The history note goes first: the saved line ends with a colon that introduces the table.
      const lines = [t(lang, 'logV2.saved', { mealType })];
      const fromHistory = draft?.dishes.find((d) => d.source === 'history' && d.history_eaten_at);
      if (fromHistory?.history_eaten_at) {
        lines.unshift(t(lang, 'logV2.saved.fromHistory', { date: formatDate(fromHistory.history_eaten_at, lang) }));
      }
      return lines.join(' ');
    }
    case 'draft':
      return t(lang, 'logV2.confirm');
    case 'question':
      return t(lang, 'logV2.question', { dish: askAbout ?? '' });
    case 'error':
      return t(lang, 'logV2.error');
  }
}

/** Plain-text version of a draft, given to the router and parser as the previous assistant message. */
export function describeDraft(draft: MealDraft): string {
  return draft.dishes
    .map((d) => `[${d.dish_name}: ${d.ingredients.map((i) => `${i.name} ${i.quantity_g} g`).join(', ')}]`)
    .join(' ');
}
