import { t } from '@/lib/i18n';
import type { RouterUsage } from '@/lib/ai/router';
import { addSteps, confirmDraft, updateSavedMeal } from './drafts';
import { buildReply } from './reply';
import { reviseNode } from './revise';
import type { MealDraft } from './schemas';
import type { NodeContext } from './types';

// ---------------------------------------------------------------------------
// A chat reply to a meal table, after the router returned 'revise'
// (research R3, data-model §6). Pending tables are saved, edited or dropped;
// a saved meal changes only after the user confirms the corrected table.
// ---------------------------------------------------------------------------

export interface ReviseTurnResult {
  reply: string;
  draft: MealDraft | null;
}

export async function handleReviseTurn(
  draft: MealDraft,
  userText: string,
  routerUsage: RouterUsage,
  ctx: NodeContext,
): Promise<ReviseTurnResult> {
  const lang = draft.language;
  const revised = await reviseNode.run({ draft, userText }, ctx);
  const { action, draft: next } = revised.output;

  const routerStep = { name: 'router:revise', input_tokens: routerUsage.inputTokens, output_tokens: routerUsage.outputTokens, latency_ms: routerUsage.latencyMs };
  const record = (patch: Parameters<typeof addSteps>[3] = {}) =>
    addSteps(ctx.supabase, draft.run_id, [routerStep, ...revised.usage], patch);

  const saved = draft.status === 'saved';

  if (action === 'cancel') {
    await record();
    return { reply: t(lang, saved ? 'logV2.keptUnchanged' : 'logV2.cancelled'), draft: null };
  }

  if (action === 'edit') {
    await record();
    // Nothing is written yet: a pending table stays pending, a saved meal gets changes_pending.
    if (!saved) return { reply: buildReply('draft', next, lang), draft: next };
    // A correction that matches what is stored leaves the saved meal as it is.
    return { reply: t(lang, next.changes_pending ? 'logV2.confirmChanges' : 'logV2.alreadySaved'), draft: next };
  }

  // confirm
  await record();
  if (saved && !draft.changes_pending) return { reply: buildReply('saved', draft, lang), draft };

  const result = saved ? await updateSavedMeal(ctx.supabase, draft) : await confirmDraft(ctx.supabase, draft);
  if (!result.ok) {
    if (result.error === 'already_saved') return { reply: buildReply('saved', { ...draft, status: 'saved' }, lang), draft: null };
    return { reply: buildReply('error', null, lang), draft };
  }
  return { reply: buildReply('saved', result.draft, lang), draft: result.draft };
}
