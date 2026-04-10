import { DashboardLayout } from './DashboardLayout';
import { MealCalendar } from '@/components/specific/MealCalendar';
import { HouseholdPanel } from '@/components/specific/HouseholdPanel';
import { LogMealFormWrapper } from '@/components/specific/LogMealFormWrapper';
import { RecommendationFetcher } from '@/components/specific/RecommendationFetcher';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Suspense } from 'react';

export default async function DashboardPage() {
  return (
    <DashboardLayout
      mealLoggerSlot={
        <Suspense fallback={<SkeletonCard />}>
          <LogMealFormWrapper />
        </Suspense>
      }
      calendarSlot={
        <Suspense fallback={<SkeletonCard />}>
          <MealCalendar />
        </Suspense>
      }
      householdSlot={
        <Suspense fallback={<SkeletonCard />}>
          <HouseholdPanel />
        </Suspense>
      }
      recommendationSlot={
        <Suspense fallback={<SkeletonCard />}>
          <RecommendationFetcher />
        </Suspense>
      }
    />
  );
}
