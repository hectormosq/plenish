'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { deleteMeal, dismissSharedMeal, type MealType } from '@/actions/meals';
import { getCalendarMeals } from '@/actions/calendar';
import {
  planSingleSlot,
  planWeekSlots,
  regenerateSlot,
  dismissPlannedMeal,
  acceptPlannedMeal,
  getPlannedMeals,
  type PlannedMeal,
} from '@/actions/plans';
import {
  Trash2,
  EyeOff,
  Clock,
  Info,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  RotateCcw,
  X as XIcon,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { useSessionLogger } from 'ai-session-logger/next';

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

const PLANNED_BG: Record<MealType, string> = {
  breakfast: 'rgba(251, 191, 36, 0.05)',
  snack:     'rgba(167, 139, 250, 0.05)',
  lunch:     'rgba(52, 211, 153, 0.05)',
  dinner:    'rgba(129, 140, 248, 0.05)',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns the Monday of the current week with time zeroed out. */
function getCurrentMonday(): Date {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Returns `count` consecutive days starting at (currentMonday + dayOffset).
 * Positive dayOffset shifts the window forward; negative shifts it back.
 */
function getVisibleDays(dayOffset: number, count: number): Date[] {
  const monday = getCurrentMonday();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayOffset + i);
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

function getWindowLabel(visibleDays: Date[], dayOffset: number, count: number): string {
  if (count === 7 && dayOffset === 0) return 'This Week';
  if (count === 7 && dayOffset === -7) return 'Last Week';
  if (count === 7 && dayOffset === 7) return 'Next Week';
  const start = visibleDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const end = visibleDays[visibleDays.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${start} – ${end}`;
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
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #9ca3af;
  border-bottom: 1px solid #1e1e1e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const WeekLabel = styled.span`
  flex: 1;
  font-size: 0.8rem;
  color: #9ca3af;
`;

const NavButton = styled.button`
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #6b7280;
  border-radius: 6px;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    color: #d1d5db;
    border-color: #3a3a3a;
    background: rgba(255,255,255,0.04);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const PlanWeekButton = styled.button<{ $loading?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid rgba(72, 199, 142, 0.3);
  color: #48c78e;
  border-radius: 6px;
  padding: 0.2rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  opacity: ${({ $loading }) => ($loading ? 0.6 : 1)};

  &:hover:not(:disabled) {
    background: rgba(72, 199, 142, 0.08);
    border-color: rgba(72, 199, 142, 0.6);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const LoadingText = styled.span`
  font-size: 0.7rem;
  color: #4b5563;
`;

const Grid = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: 88px repeat(${({ $columns }) => $columns}, minmax(80px, 1fr));
  min-width: ${({ $columns }) => ($columns >= 7 ? '660px' : 'unset')};

  @media (max-width: 639px) {
    grid-template-columns: 60px repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  }
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

  @media (max-width: 639px) {
    padding: 0.4rem 0.3rem;
    justify-content: center;
  }
`;

const LabelText = styled.span<{ $color: string }>`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $color }) => $color};

  @media (max-width: 639px) {
    font-size: 0.55rem;
    letter-spacing: 0;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
  }
`;

const Cell = styled.div<{
  $today: boolean;
  $filled: boolean;
  $bg: string;
  $shared?: boolean;
  $planned?: boolean;
  $planColor?: string;
}>`
  position: relative;
  min-height: 76px;

  @media (max-width: 639px) {
    min-height: 64px;
    padding: 0.3rem;
  }
  padding: 0.4rem;
  border-right: 1px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
  border-left: ${({ $shared }) => ($shared ? '2px solid rgba(96,165,250,0.35)' : '1px solid #1a1a1a')};
  background-color: ${({ $filled, $bg, $today }) =>
    $filled ? $bg : $today ? 'rgba(59,130,246,0.025)' : 'transparent'};
  background-image: ${({ $shared }) =>
    $shared ? 'linear-gradient(rgba(96,165,250,0.13), rgba(96,165,250,0.13))' : 'none'};
  transition: background 0.12s;
  ${({ $planned, $planColor }) =>
    $planned && $planColor
      ? `box-shadow: inset 0 0 0 1px ${$planColor}55;`
      : ''}
`;

const EmptyFutureCell = styled(Cell)`
  cursor: pointer;

  &:hover .plus-trigger {
    opacity: 1;
  }
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

const PlusTrigger = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  color: #374151;
  pointer-events: none;
`;

const PlanningSpinner = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
`;

const CellBody = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.2rem;
  padding-right: 1rem;
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

const PlannedName = styled.p`
  margin: 0;
  font-size: 0.68rem;
  color: #6b7280;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-style: italic;
`;

const PlannedActions = styled.div`
  display: flex;
  gap: 0.2rem;
  margin-top: auto;
  padding-top: 0.25rem;
`;

const PlanActionBtn = styled.button<{ $variant: 'accept' | 'regen' | 'dismiss' }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;

  ${({ $variant }) => {
    if ($variant === 'accept') return `
      background: rgba(72, 199, 142, 0.08);
      border-color: rgba(72, 199, 142, 0.25);
      color: #48c78e;
      &:hover:not(:disabled) { background: rgba(72, 199, 142, 0.18); }
    `;
    if ($variant === 'regen') return `
      background: rgba(251, 191, 36, 0.08);
      border-color: rgba(251, 191, 36, 0.25);
      color: #fbbf24;
      &:hover:not(:disabled) { background: rgba(251, 191, 36, 0.18); }
    `;
    return `
      background: rgba(107, 114, 128, 0.08);
      border-color: rgba(107, 114, 128, 0.2);
      color: #4b5563;
      &:hover:not(:disabled) { background: rgba(107, 114, 128, 0.18); }
    `;
  }}

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
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

const InfoButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  background: transparent;
  border: none;
  color: #2e2e2e;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: color 0.12s, background 0.12s;

  &:hover {
    color: #6b7280;
    background: rgba(255, 255, 255, 0.06);
  }
`;

const DismissButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.25);
  color: #60a5fa;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.12s;

  &:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.22);
    color: #93c5fd;
    border-color: rgba(96, 165, 250, 0.45);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const CoEaterLabel = styled.span`
  font-size: 0.6rem;
  color: #60a5fa;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  white-space: nowrap;
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TooltipState {
  meal: CalendarMeal;
  x: number;
  y: number;
}

export function MealWeekGrid({
  meals: initialMeals,
  daysBack: initialDaysBack = 35,
  plannedMeals: initialPlannedMeals = [],
}: {
  meals: CalendarMeal[];
  daysBack?: number;
  plannedMeals?: PlannedMeal[];
}) {
  const router = useRouter();
  const { session } = useSessionLogger();
  const isMobile = useIsMobile();
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [allMeals, setAllMeals] = useState<CalendarMeal[]>(initialMeals);
  const [loadedDaysBack, setLoadedDaysBack] = useState(initialDaysBack);
  const [allPlannedMeals, setAllPlannedMeals] = useState<PlannedMeal[]>(initialPlannedMeals);
  const [planningSlots, setPlanningSlots] = useState<Set<string>>(new Set());
  const [isPlanningWeek, setIsPlanningWeek] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // On mobile, default to showing today in view (shift to today's index in week)
  const mobileInitialized = useRef(false);
  useEffect(() => {
    if (isMobile && !mobileInitialized.current) {
      mobileInitialized.current = true;
      const dow = new Date().getDay(); // 0=Sun
      const indexInWeek = dow === 0 ? 6 : dow - 1; // 0=Mon … 6=Sun
      setDayOffset(Math.max(0, indexInWeek - 1));
    }
  }, [isMobile]);

  // Close tooltip on click outside
  useEffect(() => {
    if (!tooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltip(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [tooltip]);

  // Close tooltip on scroll
  useEffect(() => {
    const close = () => setTooltip(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  const visibleCount = isMobile ? 3 : 7;
  const visibleDays = getVisibleDays(dayOffset, visibleCount);
  const todayKey = toDayKey(new Date());

  const handlePrev = async () => {
    const newOffset = dayOffset - 1;
    const newFirstDay = getVisibleDays(newOffset, 1)[0];
    const daysNeeded = Math.ceil((Date.now() - newFirstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (daysNeeded > loadedDaysBack) {
      setIsLoadingMore(true);
      const newDaysBack = loadedDaysBack + 28;
      const moreMeals = await getCalendarMeals(newDaysBack);
      setAllMeals(moreMeals);
      setLoadedDaysBack(newDaysBack);
      setIsLoadingMore(false);
    }

    setDayOffset(newOffset);
  };

  const handleNext = async () => {
    const newOffset = dayOffset + 1;
    const newLastDays = getVisibleDays(newOffset, visibleCount);
    const newLastDay = newLastDays[newLastDays.length - 1];
    const newLastDayKey = toDayKey(newLastDay);

    const maxLoadedPlanned = allPlannedMeals.reduce<string>(
      (max, p) => (p.planned_date > max ? p.planned_date : max),
      todayKey,
    );

    if (newLastDayKey > maxLoadedPlanned && newOffset > 0) {
      const newEnd = new Date(newLastDay);
      newEnd.setDate(newEnd.getDate() + 56); // 8 more weeks buffer
      const morePlanned = await getPlannedMeals(todayKey, newEnd.toISOString().split('T')[0]);
      setAllPlannedMeals(morePlanned);
    }

    setDayOffset(newOffset);
  };

  const handleInfoClick = (e: React.MouseEvent, meal: CalendarMeal) => {
    e.stopPropagation();
    if (tooltip?.meal.id === meal.id) {
      setTooltip(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ meal, x: rect.left + rect.width / 2, y: rect.top - 6 });
  };

  const handleDelete = (id: string) => {
    session.buttonClick('delete_meal', { id });
    startTransition(async () => {
      await deleteMeal(id);
      setTooltip(null);
      router.refresh();
    });
  };

  const handleDismiss = (id: string) => {
    session.buttonClick('dismiss_shared_meal', { id });
    startTransition(async () => {
      await dismissSharedMeal(id);
      setTooltip(null);
      router.refresh();
    });
  };

  // ─── Planned meal handlers ───────────────────────────────────────────────

  const handlePlanSlot = async (mealType: MealType, date: string) => {
    session.buttonClick('plan_slot', { meal_type: mealType, date });
    const slotKey = `${date}-${mealType}`;
    setPlanningSlots((prev) => new Set(prev).add(slotKey));
    try {
      const planned = await planSingleSlot(mealType, date);
      setAllPlannedMeals((prev) => [...prev, planned]);
    } finally {
      setPlanningSlots((prev) => {
        const next = new Set(prev);
        next.delete(slotKey);
        return next;
      });
    }
  };

  const handleRegenerate = async (id: string, mealType: MealType, date: string) => {
    session.buttonClick('regenerate_slot', { meal_type: mealType, date });
    const slotKey = `${date}-${mealType}`;
    setPlanningSlots((prev) => new Set(prev).add(slotKey));
    try {
      // Optimistically remove old
      setAllPlannedMeals((prev) => prev.filter((p) => p.id !== id));
      const newPlan = await regenerateSlot(id, mealType, date);
      setAllPlannedMeals((prev) => [...prev, newPlan]);
    } finally {
      setPlanningSlots((prev) => {
        const next = new Set(prev);
        next.delete(slotKey);
        return next;
      });
    }
  };

  const handleDismissPlanned = (id: string) => {
    session.buttonClick('dismiss_planned', { id });
    // Optimistic removal
    setAllPlannedMeals((prev) => prev.filter((p) => p.id !== id));
    void dismissPlannedMeal(id);
  };

  const handleAcceptPlanned = (id: string, mealType: MealType, date: string, name: string) => {
    session.buttonClick('accept_planned', { meal_type: mealType, date, name });
    // Fire-and-forget status update
    void acceptPlannedMeal(id);
    // Navigate to MealLogger with prefill
    router.push(
      `/dashboard?prefillType=${encodeURIComponent(mealType)}&prefillText=${encodeURIComponent(name)}&prefillDate=${encodeURIComponent(date)}`,
    );
  };

  const handlePlanWeek = async () => {
    setIsPlanningWeek(true);
    try {
      const emptySlots: { mealType: MealType; date: string }[] = [];
      for (const mealType of MEAL_TYPES) {
        for (const day of visibleDays) {
          const dayKey = toDayKey(day);
          if (dayKey < todayKey) continue; // skip past
          const hasLogged = bySlot.has(`${dayKey}-${mealType}`);
          const hasPlanned = plannedBySlot.has(`${dayKey}-${mealType}`);
          if (!hasLogged && !hasPlanned) {
            emptySlots.push({ mealType, date: dayKey });
          }
        }
      }

      if (emptySlots.length === 0) return;

      session.buttonClick('plan_week', { slots: emptySlots.length });
      const newPlans = await planWeekSlots(emptySlots);
      setAllPlannedMeals((prev) => [...prev, ...newPlans]);
    } finally {
      setIsPlanningWeek(false);
    }
  };

  // Group meals by "YYYY-MM-DD-mealtype"
  const bySlot = new Map<string, CalendarMeal[]>();
  for (const meal of allMeals) {
    const key = `${toLocalDayKey(meal.eaten_at)}-${meal.meal_type}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(meal);
  }

  // Group planned meals by slot (latest per slot = the active one)
  const plannedBySlot = new Map<string, PlannedMeal>();
  for (const plan of allPlannedMeals) {
    const key = `${plan.planned_date}-${plan.meal_type}`;
    const existing = plannedBySlot.get(key);
    if (!existing || plan.created_at > existing.created_at) {
      plannedBySlot.set(key, plan);
    }
  }

  // Determine if "Plan Week" should be active (any visible day is today or future)
  const planWeekActive = visibleDays.some((d) => toDayKey(d) >= todayKey);

  return (
    <Wrapper>
      <Title>
        <NavButton onClick={handlePrev} disabled={isLoadingMore} title="Previous">
          <ChevronLeft size={13} />
        </NavButton>
        <span style={{ color: '#3b82f6', fontSize: '0.875rem' }}>📅</span>
        <WeekLabel>
          {isLoadingMore ? <LoadingText>Loading…</LoadingText> : getWindowLabel(visibleDays, dayOffset, visibleCount)}
        </WeekLabel>
        {planWeekActive && (
          <PlanWeekButton
            onClick={handlePlanWeek}
            disabled={isPlanningWeek}
            $loading={isPlanningWeek}
            title="Plan all empty slots in view"
          >
            {isPlanningWeek ? (
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <CalendarDays size={11} />
            )}
            Plan Week
          </PlanWeekButton>
        )}
        <NavButton onClick={handleNext} title="Next">
          <ChevronRight size={13} />
        </NavButton>
      </Title>

      <Grid $columns={visibleCount}>
        {/* Header row */}
        <CornerCell />
        {visibleDays.map((day) => {
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

            {visibleDays.map((day) => {
              const dayKey = toDayKey(day);
              const isToday = dayKey === todayKey;
              const slotKey = `${dayKey}-${mealType}`;
              const slot = bySlot.get(slotKey) ?? [];
              const primary = slot[0] ?? null;
              const planned = plannedBySlot.get(slotKey) ?? null;
              const isPlanning = planningSlots.has(slotKey);
              const isFuture = dayKey >= todayKey;

              // ── Logged meal ──────────────────────────────────────────────
              if (primary) {
                const coEaters = (primary.meal_participants ?? []).filter((p) => !p.dismissed);
                return (
                  <Cell key={dayKey} $today={isToday} $filled $bg={MEAL_BG[mealType]} $shared={primary.is_shared}>
                    <CellBody>
                      <CellText>{primary.log_text}</CellText>
                      <CellFooter>
                        {primary.is_shared && (
                          <CoEaterLabel>
                            👥{coEaters.length > 0 ? ` ${coEaters.length}` : ''}
                          </CoEaterLabel>
                        )}
                        {slot.length > 1 && <ExtraCount>+{slot.length - 1}</ExtraCount>}
                      </CellFooter>
                    </CellBody>
                    {!primary.isOwn ? (
                      <DismissButton
                        onClick={(e) => { e.stopPropagation(); handleDismiss(primary.id); }}
                        disabled={isPending}
                        title="Dismiss shared meal"
                      >
                        <XIcon size={9} />
                      </DismissButton>
                    ) : (
                      <InfoButton onClick={(e) => handleInfoClick(e, primary)} title="Meal details">
                        <Info size={10} />
                      </InfoButton>
                    )}
                  </Cell>
                );
              }

              // ── Planning spinner ─────────────────────────────────────────
              if (isPlanning) {
                return (
                  <Cell key={dayKey} $today={isToday} $filled={false} $bg="">
                    <PlanningSpinner>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    </PlanningSpinner>
                  </Cell>
                );
              }

              // ── Planned meal ─────────────────────────────────────────────
              if (planned) {
                return (
                  <Cell
                    key={dayKey}
                    $today={isToday}
                    $filled
                    $bg={PLANNED_BG[mealType]}
                    $planned
                    $planColor={MEAL_COLOR[mealType]}
                  >
                    <CellBody>
                      <PlannedName title={planned.name}>{planned.name}</PlannedName>
                      <PlannedActions>
                        <PlanActionBtn
                          $variant="accept"
                          title="Accept — pre-fill meal logger"
                          onClick={() =>
                            handleAcceptPlanned(planned.id, mealType, dayKey, planned.name)
                          }
                        >
                          <Check size={9} />
                        </PlanActionBtn>
                        <PlanActionBtn
                          $variant="regen"
                          title="Regenerate suggestion"
                          onClick={() => handleRegenerate(planned.id, mealType, dayKey)}
                        >
                          <RotateCcw size={9} />
                        </PlanActionBtn>
                        <PlanActionBtn
                          $variant="dismiss"
                          title="Dismiss"
                          onClick={() => handleDismissPlanned(planned.id)}
                        >
                          <XIcon size={9} />
                        </PlanActionBtn>
                      </PlannedActions>
                    </CellBody>
                  </Cell>
                );
              }

              // ── Empty future cell ────────────────────────────────────────
              if (isFuture) {
                return (
                  <EmptyFutureCell
                    key={dayKey}
                    $today={isToday}
                    $filled={false}
                    $bg=""
                    onClick={() => handlePlanSlot(mealType, dayKey)}
                    title="Plan this meal"
                  >
                    <PlusTrigger className="plus-trigger">
                      <Plus size={14} />
                    </PlusTrigger>
                  </EmptyFutureCell>
                );
              }

              // ── Empty past cell ──────────────────────────────────────────
              return (
                <Cell key={dayKey} $today={isToday} $filled={false} $bg="">
                  <Ghost>—</Ghost>
                </Cell>
              );
            })}
          </React.Fragment>
        ))}
      </Grid>

      {/* Tooltip — click-triggered, fixed position */}
      {tooltip && (
        <TooltipPortal ref={tooltipRef} $x={tooltip.x} $y={tooltip.y}>
          <TipText>{tooltip.meal.log_text}</TipText>
          <TipMeta>
            <Clock size={10} />
            {formatTime(tooltip.meal.eaten_at)}
            {tooltip.meal.is_shared && (
              <span>
                · 👥{' '}
                {(tooltip.meal.meal_participants ?? []).filter((p) => !p.dismissed).length}{' '}
                co-eater(s)
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Wrapper>
  );
}
