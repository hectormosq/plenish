import { DashboardLayout } from './DashboardLayout';
import { MealCalendar } from '@/components/specific/MealCalendar';
import { LogMealFormWrapper } from '@/components/specific/LogMealFormWrapper';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Suspense } from 'react';
import type { MealType } from '@/actions/meals';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const prefillType = params.prefillType as MealType | undefined;
  const prefillText = params.prefillText;
  const prefillDate = params.prefillDate;

  return (
    <DashboardLayout
      mealLoggerSlot={
        <Suspense fallback={<SkeletonCard />}>
          <LogMealFormWrapper
            initialMealType={prefillType}
            initialText={prefillText}
            initialDate={prefillDate}
          />
        </Suspense>
      }
      calendarSlot={
        <Suspense fallback={<SkeletonCard />}>
          <MealCalendar />
        </Suspense>
      }
    />
  );
}
