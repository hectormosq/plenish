'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { deleteMeal, dismissSharedMeal, type MealType } from '@/actions/meals';
import { Trash2, EyeOff, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarMeal {
  id: string;
  user_id: string;
  log_text: string;
  meal_type: MealType;
  eaten_at: string;
  is_shared: boolean;
  isOwn: boolean;
  meal_participants?: Array<{ user_id: string; dismissed: boolean }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPES: MealType[] = ['breakfast', 'snack', 'lunch', 'dinner'];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  snack: 'Snack',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const MEAL_COLOR: Record<MealType, string> = {
  breakfast: '#fbbf24',
  snack:     '#a78bfa',
  lunch:     '#34d399',
  dinner:    '#818cf8',
};

const MEAL_BG: Record<MealType, string> = {
  breakfast: 'rgba(251, 191, 36, 0.10)',
  snack:     'rgba(167, 139, 250, 0.10)',
  lunch:     'rgba(52, 211, 153, 0.10)',
  dinner:    'rgba(129, 140, 248, 0.10)',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDays(): Date[] {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayName(date: Date, isToday: boolean): string {
  if (isToday) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatDayDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ─── Styled Components ────────────────────────────────────────────────────────

const Wrapper = styled.div`
  background: #111;
  border: 1px solid #1e1e1e;
  border-radius: 16px;
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
`;

const Title = styled.div`
  padding: 1rem 1.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #9ca3af;
  border-bottom: 1px solid #1e1e1e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 72px repeat(7, minmax(96px, 1fr));
  min-width: 750px;
`;

const CornerCell = styled.div`
  border-right: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
`;

const HeaderCell = styled.div<{ $today: boolean }>`
  padding: 0.625rem 0.5rem;
  text-align: center;
  border-right: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
  background: ${({ $today }) => ($today ? 'rgba(59,130,246,0.07)' : 'transparent')};
`;

const DayName = styled.div<{ $today: boolean }>`
  font-size: 0.75rem;
  font-weight: ${({ $today }) => ($today ? 700 : 500)};
  color: ${({ $today }) => ($today ? '#60a5fa' : '#6b7280')};
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const DayDate = styled.div`
  font-size: 0.65rem;
  color: #374151;
  margin-top: 0.1rem;
`;

const RowLabel = styled.div<{ $color: string }>`
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-right: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
`;

const LabelText = styled.span<{ $color: string }>`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $color }) => $color};
`;

const Cell = styled.div<{ $today: boolean; $filled: boolean; $bg: string }>`
  position: relative;
  min-height: 76px;
  padding: 0.4rem;
  border-right: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
  background: ${({ $filled, $bg, $today }) =>
    $filled ? $bg : $today ? 'rgba(59,130,246,0.025)' : 'transparent'};
  transition: background 0.12s;

  ${({ $filled, $today }) =>
    $filled &&
    `&:hover {
      background: ${$today ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)'};
    }`}
`;

const Ghost = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f1f1f;
  font-size: 0.875rem;
  pointer-events: none;
`;

const CellBody = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.2rem;
`;

const CellText = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: #d1d5db;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CellFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: auto;
`;

const ExtraCount = styled.span`
  font-size: 0.6rem;
  color: #4b5563;
`;

// ─── Tooltip (fixed position, rendered at root of component) ─────────────────

const TooltipPortal = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  transform: translateX(-50%) translateY(-100%);
  z-index: 50;
  width: 224px;
  background: #1c1c1c;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  padding: 0.75rem;
  box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  pointer-events: all;
`;

const TipText = styled.p`
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  color: #e5e7eb;
  line-height: 1.4;
`;

const TipMeta = styled.p`
  margin: 0 0 0.6rem;
  font-size: 0.7rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const TipActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const TipButton = styled.button<{ $variant: 'delete' | 'dismiss' }>`
  flex: 1;
  background: ${({ $variant }) =>
    $variant === 'delete' ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)'};
  color: ${({ $variant }) => ($variant === 'delete' ? '#ef4444' : '#9ca3af')};
  border: 1px solid ${({ $variant }) =>
    $variant === 'delete' ? 'rgba(239,68,68,0.25)' : 'rgba(107,114,128,0.2)'};
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  transition: all 0.12s;

  &:hover:not(:disabled) {
    background: ${({ $variant }) =>
      $variant === 'delete' ? 'rgba(239,68,68,0.2)' : 'rgba(107,114,128,0.2)'};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface TooltipState {
  meal: CalendarMeal;
  x: number;
  y: number;
}

export function MealWeekGrid({ meals }: { meals: CalendarMeal[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close tooltip on scroll
  useEffect(() => {
    const close = () => setTooltip(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  const weekDays = getWeekDays();
  const todayKey = toDayKey(new Date());

  // Group meals by "YYYY-MM-DD-mealtype"
  const bySlot = new Map<string, CalendarMeal[]>();
  for (const meal of meals) {
    const key = `${toLocalDayKey(meal.eaten_at)}-${meal.meal_type}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(meal);
  }

  const showTooltip = (e: React.MouseEvent, meal: CalendarMeal) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ meal, x: rect.left + rect.width / 2, y: rect.top - 6 });
  };

  const hideTooltip = () => {
    leaveTimer.current = setTimeout(() => setTooltip(null), 120);
  };

  const keepTooltip = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteMeal(id);
      setTooltip(null);
      router.refresh();
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      await dismissSharedMeal(id);
      setTooltip(null);
      router.refresh();
    });
  };

  return (
    <Wrapper>
      <Title>
        <span style={{ color: '#3b82f6' }}>📅</span> This Week
      </Title>

      <Grid>
        {/* Header row */}
        <CornerCell />
        {weekDays.map((day) => {
          const key = toDayKey(day);
          const isToday = key === todayKey;
          return (
            <HeaderCell key={key} $today={isToday}>
              <DayName $today={isToday}>{formatDayName(day, isToday)}</DayName>
              <DayDate>{formatDayDate(day)}</DayDate>
            </HeaderCell>
          );
        })}

        {/* Meal type rows */}
        {MEAL_TYPES.map((mealType) => (
          <React.Fragment key={mealType}>
            <RowLabel $color={MEAL_COLOR[mealType]}>
              <LabelText $color={MEAL_COLOR[mealType]}>{MEAL_LABELS[mealType]}</LabelText>
            </RowLabel>

            {weekDays.map((day) => {
              const dayKey = toDayKey(day);
              const isToday = dayKey === todayKey;
              const slot = bySlot.get(`${dayKey}-${mealType}`) ?? [];
              const primary = slot[0] ?? null;

              if (!primary) {
                return (
                  <Cell key={dayKey} $today={isToday} $filled={false} $bg="">
                    <Ghost>—</Ghost>
                  </Cell>
                );
              }

              const coEaters = (primary.meal_participants ?? []).filter((p) => !p.dismissed);

              return (
                <Cell
                  key={dayKey}
                  $today={isToday}
                  $filled
                  $bg={MEAL_BG[mealType]}
                  onMouseEnter={(e) => showTooltip(e, primary)}
                  onMouseLeave={hideTooltip}
                >
                  <CellBody>
                    <CellText>{primary.log_text}</CellText>
                    <CellFooter>
                      {primary.is_shared && (
                        <span
                          style={{ fontSize: '0.65rem' }}
                          title={coEaters.length > 0 ? `Shared with ${coEaters.length} co-eater(s)` : 'Shared'}
                        >
                          👥
                        </span>
                      )}
                      {slot.length > 1 && <ExtraCount>+{slot.length - 1}</ExtraCount>}
                    </CellFooter>
                  </CellBody>
                </Cell>
              );
            })}
          </React.Fragment>
        ))}
      </Grid>

      {/* Tooltip rendered at component root with fixed position */}
      {tooltip && (
        <TooltipPortal
          $x={tooltip.x}
          $y={tooltip.y}
          onMouseEnter={keepTooltip}
          onMouseLeave={hideTooltip}
        >
          <TipText>{tooltip.meal.log_text}</TipText>
          <TipMeta>
            <Clock size={10} />
            {formatTime(tooltip.meal.eaten_at)}
            {tooltip.meal.is_shared && (
              <span>
                · 👥 {(tooltip.meal.meal_participants ?? []).filter((p) => !p.dismissed).length} co-eater(s)
              </span>
            )}
          </TipMeta>
          <TipActions>
            {tooltip.meal.isOwn ? (
              <TipButton
                $variant="delete"
                onClick={() => handleDelete(tooltip.meal.id)}
                disabled={isPending}
              >
                <Trash2 size={11} /> Delete
              </TipButton>
            ) : (
              <TipButton
                $variant="dismiss"
                onClick={() => handleDismiss(tooltip.meal.id)}
                disabled={isPending}
              >
                <EyeOff size={11} /> Dismiss
              </TipButton>
            )}
          </TipActions>
        </TooltipPortal>
      )}
    </Wrapper>
  );
}
