'use client';

import React, { useState, useTransition } from 'react';
import styled from 'styled-components';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmMealDraft, updateMealIngredients } from '@/actions/meal-drafts';
import { t } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import type { MealDraft, QuantitySource } from '@/lib/ai/log-v2/schemas';

// ─── Styles ────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
  min-width: 0;
`;

const DishBlock = styled.div`
  border: 1px solid #3a3a3a;
  border-radius: 10px;
  overflow: hidden;
`;

const DishHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #232323;
  font-weight: 600;
  font-size: 0.9rem;
  color: #f5f5f5;
`;

const DishNote = styled.span`
  font-weight: 400;
  font-size: 0.72rem;
  color: #8a8a8a;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid #2c2c2c;
  font-size: 0.85rem;
`;

const Name = styled.span`
  overflow-wrap: anywhere;
  color: #e5e5e5;
`;

const Grams = styled.span`
  color: #cfcfcf;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const TextInput = styled.input`
  width: 100%;
  min-width: 0;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #f5f5f5;
  padding: 0.3rem 0.45rem;
  font-size: 0.85rem;
  &:focus { outline: none; border-color: #3b82f6; }
`;

const GramsInput = styled(TextInput)`
  width: 4.5rem;
  text-align: right;
`;

const EditRow = styled(Row)`
  grid-template-columns: minmax(0, 1fr) auto auto;
`;

const IconButton = styled.button`
  display: inline-flex;
  background: transparent;
  border: none;
  color: #8a8a8a;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 6px;
  transition: color 0.15s ease, background 0.15s ease;
  &:hover { color: #fca5a5; background: #2f2f2f; }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`;

const ErrorText = styled.span`
  color: #fca5a5;
  font-size: 0.8rem;
`;

// ─── Helpers ───────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<QuantitySource, { key: MessageKey; tone: BadgeTone }> = {
  estimated: { key: 'logV2.table.estimated', tone: 'neutral' },
  history:   { key: 'logV2.table.estimated', tone: 'neutral' },
  stated:    { key: 'logV2.table.stated',    tone: 'accent' },
  user:      { key: 'logV2.table.yours',     tone: 'success' },
};

function hasEstimates(draft: MealDraft): boolean {
  return draft.dishes.some((d) => d.ingredients.some((i) => i.quantity_source !== 'user' && i.quantity_source !== 'stated'));
}

function formatDate(iso: string, lang: MealDraft['language']): string {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' });
}

// ─── Component ─────────────────────────────────────────────────────────────

/** Remount with a new `key` when the draft changes on the server (e.g. after a save). */
interface MealDraftTableProps {
  draft: MealDraft;
  /** Only the latest table of the conversation can be edited or saved. */
  isLatest: boolean;
  /** Called with the server's version after a save. */
  onChange?: (draft: MealDraft) => void;
}

export function MealDraftTable({ draft, isLatest, onChange }: MealDraftTableProps) {
  const lang = draft.language;
  const [editing, setEditing] = useState(false);
  const [work, setWork] = useState<MealDraft>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saved = draft.status === 'saved';
  const shown = editing ? work : draft;
  const canAct = isLatest && !pending;
  // Rows without a name are dropped on save, so a dish needs at least one named row.
  const emptyDish = work.dishes.some((d) => !d.ingredients.some((i) => i.name.trim()));

  const updateRow = (di: number, ii: number, patch: { name?: string; quantity_g?: number }) =>
    setWork((w) => ({
      ...w,
      dishes: w.dishes.map((d, i) => i !== di ? d : {
        ...d,
        ingredients: d.ingredients.map((ing, j) => (j !== ii ? ing : { ...ing, ...patch, quantity_source: 'user' })),
      }),
    }));

  const removeRow = (di: number, ii: number) =>
    setWork((w) => ({
      ...w,
      dishes: w.dishes.map((d, i) => (i !== di ? d : { ...d, ingredients: d.ingredients.filter((_, j) => j !== ii) })),
    }));

  const addRow = (di: number) =>
    setWork((w) => ({
      ...w,
      dishes: w.dishes.map((d, i) => (i !== di ? d : {
        ...d,
        ingredients: [...d.ingredients, { name: '', quantity_g: 50, quantity_source: 'user' }],
      })),
    }));

  const submit = () => {
    setError(null);
    const payload: MealDraft = {
      ...work,
      dishes: work.dishes.map((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i.name.trim()) })),
      changes_pending: saved,
    };
    startTransition(async () => {
      const result = saved ? await updateMealIngredients(payload) : await confirmMealDraft(payload);
      if (result.ok) {
        onChange?.(result.draft);
        setEditing(false);
      } else {
        setError(t(lang, 'logV2.error'));
      }
    });
  };

  // A pending table can be saved as shown; a saved one only after editing.
  const showSave = canAct && (editing || (!saved) || draft.changes_pending);

  return (
    <Wrapper>
      {shown.dishes.map((dish, di) => (
        <DishBlock key={`${dish.dish_key}-${di}`}>
          <DishHeader>
            <span>{dish.dish_name}</span>
            {dish.source === 'history' && dish.history_eaten_at && (
              <DishNote>{t(lang, 'logV2.table.fromHistory')} · {formatDate(dish.history_eaten_at, lang)}</DishNote>
            )}
          </DishHeader>

          {dish.ingredients.map((ing, ii) => editing ? (
            <EditRow key={ii}>
              <TextInput
                aria-label={t(lang, 'logV2.table.ingredient')}
                value={ing.name}
                onChange={(e) => updateRow(di, ii, { name: e.target.value })}
              />
              <GramsInput
                aria-label={t(lang, 'logV2.table.amount')}
                type="number"
                min={1}
                inputMode="numeric"
                value={ing.quantity_g}
                onChange={(e) => updateRow(di, ii, { quantity_g: Math.max(1, Number(e.target.value) || 1) })}
              />
              <IconButton type="button" aria-label={t(lang, 'logV2.actions.remove')} onClick={() => removeRow(di, ii)}>
                <Trash2 size={15} />
              </IconButton>
            </EditRow>
          ) : (
            <Row key={ii}>
              <Name>{ing.name}</Name>
              <Grams>{ing.quantity_g} g</Grams>
              <Badge $tone={SOURCE_LABEL[ing.quantity_source].tone}>{t(lang, SOURCE_LABEL[ing.quantity_source].key)}</Badge>
            </Row>
          ))}

          {editing && (
            <Row>
              <Button type="button" $variant="ghost" $size="sm" onClick={() => addRow(di)}>
                <Plus size={14} /> {t(lang, 'logV2.actions.addIngredient')}
              </Button>
            </Row>
          )}
        </DishBlock>
      ))}

      {hasEstimates(shown) && <Alert tone="warning">{t(lang, 'logV2.estimatedAlert')}</Alert>}

      {isLatest && (
        <Actions>
          {showSave && (
            <Button type="button" $size="sm" disabled={pending || (editing && emptyDish)} onClick={submit}>
              {t(lang, saved ? 'logV2.actions.saveChanges' : 'logV2.actions.save')}
            </Button>
          )}
          {!editing && canAct && (
            <Button type="button" $variant="secondary" $size="sm" onClick={() => setEditing(true)}>
              <Pencil size={13} /> {t(lang, 'logV2.actions.edit')}
            </Button>
          )}
          {editing && (
            <Button type="button" $variant="ghost" $size="sm" disabled={pending} onClick={() => { setWork(draft); setEditing(false); }}>
              {t(lang, 'logV2.actions.cancel')}
            </Button>
          )}
          {error && <ErrorText role="alert">{error}</ErrorText>}
        </Actions>
      )}
    </Wrapper>
  );
}
