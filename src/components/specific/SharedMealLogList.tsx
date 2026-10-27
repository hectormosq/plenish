'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { dismissSharedMeal } from '@/actions/meals';
import { Card, CardTitle } from '@/components/ui/Card';
import { Users, Clock, EyeOff } from 'lucide-react';
import { theme, alpha } from '@/theme';

// ─── Styled Components ────────────────────────────────────────────────────────

const MealList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const MealItem = styled.div`
  background: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.lg};
  padding: 0.875rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  transition: border-color 0.2s;

  &:hover { border-color: ${theme.colors.border}; }
`;

const MealInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
`;

const MealMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const MealTypeBadge = styled.span<{ $type: string }>`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $type }) =>
    $type === 'breakfast' ? theme.colors.secondary :
    $type === 'lunch'     ? theme.colors.primaryBright :
    $type === 'dinner'    ? theme.colors.indigo : theme.colors.violet};
`;

const SharedBadge = styled.span`
  font-size: 0.65rem;
  font-weight: 500;
  background: ${alpha(theme.colors.primary, 0.1)};
  color: ${theme.colors.primaryBright};
  border-radius: ${theme.radii.sm};
  padding: 0.1rem 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const TimeStamp = styled.span`
  font-size: 0.75rem;
  color: ${theme.colors.textMuted};
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const MealText = styled.p`
  margin: 0;
  color: ${theme.colors.text};
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ParticipantRow = styled.div`
  font-size: 0.75rem;
  color: ${theme.colors.textMuted};
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
`;

const DismissButton = styled.button`
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: ${theme.colors.textMuted};
  cursor: pointer;
  padding: 0.3rem;
  border-radius: ${theme.radii.md};
  display: flex;
  align-items: center;
  transition: color 0.2s, background 0.2s;

  &:hover { background: ${alpha(theme.colors.textMuted, 0.15)}; color: ${theme.colors.textSecondary}; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const DismissError = styled.p`
  margin: 0.25rem 0 0;
  color: ${theme.colors.dangerBright};
  font-size: 0.8rem;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  user_id: string;
  dismissed: boolean;
}

interface SharedMeal {
  id: string;
  log_text: string;
  meal_type: string;
  user_id: string;
  eaten_at: string;
  meal_participants?: Participant[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SharedMealLogList({ meals }: { meals: SharedMeal[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissError, setDismissError] = React.useState<string | null>(null);

  const handleDismiss = (mealId: string) => {
    if (!confirm('Hide this shared meal from your view?')) return;
    setDismissError(null);
    startTransition(async () => {
      try {
        await dismissSharedMeal(mealId);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        // Silently ignore when the original logger accidentally hits dismiss
        if (message.includes('logged yourself')) return;
        setDismissError(message || 'Failed to dismiss meal.');
      }
    });
  };

  return (
    <Card>
      <CardTitle>
        <Users size={20} style={{ color: theme.colors.primary }} />
        Household Meals
      </CardTitle>

      {dismissError && <DismissError>{dismissError}</DismissError>}
      <MealList>
        {meals.map((meal) => {
          const date = new Date(meal.eaten_at);
          const formatted = date.toLocaleDateString('en-US', {
            weekday: 'short', hour: 'numeric', minute: '2-digit',
          });
          const participantCount = (meal.meal_participants ?? []).filter((p) => !p.dismissed).length;

          return (
            <MealItem key={meal.id}>
              <MealInfo>
                <MealMeta>
                  <MealTypeBadge $type={meal.meal_type}>● {meal.meal_type}</MealTypeBadge>
                  <SharedBadge><Users size={9} /> shared</SharedBadge>
                  <TimeStamp><Clock size={10} />{formatted}</TimeStamp>
                </MealMeta>
                <MealText>{meal.log_text}</MealText>
                {participantCount > 0 && (
                  <ParticipantRow>
                    <Users size={10} />
                    {participantCount} co-eater{participantCount !== 1 ? 's' : ''}
                  </ParticipantRow>
                )}
              </MealInfo>
              <DismissButton
                onClick={() => handleDismiss(meal.id)}
                disabled={isPending}
                title="Hide from my view"
              >
                <EyeOff size={14} />
              </DismissButton>
            </MealItem>
          );
        })}
      </MealList>
    </Card>
  );
}
