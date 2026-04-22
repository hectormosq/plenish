'use client';

import React, { useEffect } from 'react';
import styled from 'styled-components';
import type { MealType } from '@/actions/meals';

// ─── Styled Components ────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
`;

const Card = styled.div`
  position: fixed;
  z-index: 50;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1rem;
  min-width: 180px;
  max-width: 240px;
  width: max-content;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
`;

const CardTitle = styled.p`
  font-size: 0.7rem;
  font-weight: 600;
  color: #555;
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
    $primary ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)'};
  border: 1px solid
    ${({ $primary }) =>
      $primary ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)'};
  color: ${({ $primary }) => ($primary ? '#60a5fa' : '#9ca3af')};
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s;

  &:hover {
    background: ${({ $primary }) =>
      $primary ? 'rgba(59, 130, 246, 0.22)' : 'rgba(255, 255, 255, 0.08)'};
    border-color: ${({ $primary }) =>
      $primary ? 'rgba(59, 130, 246, 0.55)' : 'rgba(255, 255, 255, 0.15)'};
    color: ${({ $primary }) => ($primary ? '#93c5fd' : '#d1d5db')};
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
        <CardTitle>{mealType}</CardTitle>
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
