'use client';

import React, { useEffect } from 'react';
import styled from 'styled-components';
import type { MealType } from '@/actions/meals';
import { theme, alpha } from '@/theme';
import { t } from '@/lib/i18n';

// ─── Styled Components ────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
`;

const Card = styled.div`
  position: fixed;
  z-index: 50;
  background: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.lg};
  padding: 1rem;
  min-width: 180px;
  max-width: 240px;
  width: max-content;
  box-shadow: ${theme.shadows.popover};
`;

const CardTitle = styled.p`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
`;

const ActionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  width: 100%;
  background: ${({ $primary }) =>
    $primary ? alpha(theme.colors.primary, 0.12) : theme.colors.overlay};
  border: 1px solid
    ${({ $primary }) =>
      $primary ? alpha(theme.colors.primary, 0.35) : theme.colors.border};
  color: ${({ $primary }) => ($primary ? theme.colors.primaryBright : theme.colors.textSecondary)};
  border-radius: ${theme.radii.md};
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s;

  &:hover {
    background: ${({ $primary }) =>
      $primary ? alpha(theme.colors.primary, 0.22) : theme.colors.overlayStrong};
    border-color: ${({ $primary }) =>
      $primary ? alpha(theme.colors.primary, 0.55) : theme.colors.borderStrong};
    color: ${({ $primary }) => ($primary ? theme.colors.primaryBright : theme.colors.textSecondary)};
  }
`;

// ─── Bilingual Labels ─────────────────────────────────────────────────────────

const LABELS = {
  en: { recommend: 'Get Recommendation', log: 'Log a Meal' },
  es: { recommend: 'Obtener recomendación', log: 'Registrar comida' },
} as const;

// ─── Position helpers ─────────────────────────────────────────────────────────

const CARD_WIDTH = 220;
const CARD_HEIGHT = 140; // estimated for two buttons, with wrapping margin
const GAP = 8;
const EDGE_MARGIN = 8;

function computeCardPosition(cellRect: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const anchorX = cellRect.left + cellRect.width / 2;
  const showAbove = cellRect.bottom + CARD_HEIGHT + GAP > vh - EDGE_MARGIN;

  const top = showAbove
    ? cellRect.top - CARD_HEIGHT - GAP
    : cellRect.bottom + GAP;

  const left = Math.max(
    EDGE_MARGIN,
    Math.min(anchorX - CARD_WIDTH / 2, vw - CARD_WIDTH - EDGE_MARGIN),
  );

  return { top, left };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface CellActionPickerProps {
  date: string;
  mealType: MealType;
  isFuture: boolean;
  cellRect: DOMRect;
  lang?: 'en' | 'es';
  onGetRecommendation: (mealType: MealType, date: string) => void;
  onLogMeal: (mealType: MealType, date: string) => void;
  onClose: () => void;
}

export function CellActionPicker({
  date,
  mealType,
  isFuture,
  cellRect,
  lang = 'es',
  onGetRecommendation,
  onLogMeal,
  onClose,
}: CellActionPickerProps) {
  const labels = LABELS[lang];
  const { top, left } = computeCardPosition(cellRect);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <Overlay onClick={onClose} />
      <Card style={{ top, left }}>
        <CardTitle>{t(lang, `mealSlot.${mealType}`)}</CardTitle>
        <ActionList>
          {isFuture && (
            <ActionButton
              $primary
              type="button"
              onClick={() => onGetRecommendation(mealType, date)}
            >
              {labels.recommend}
            </ActionButton>
          )}
          <ActionButton
            type="button"
            onClick={() => onLogMeal(mealType, date)}
          >
            {labels.log}
          </ActionButton>
        </ActionList>
      </Card>
    </>
  );
}
