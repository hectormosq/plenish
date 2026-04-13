import React from 'react';
import { getHousehold } from '@/actions/households';
import { getShareDefault } from '@/actions/profile';
import { MealLogger } from './MealLogger';

export async function LogMealFormWrapper() {
  const [household, shareDefault] = await Promise.all([
    getHousehold(),
    getShareDefault(),
  ]);

  const members = household
    ? household.members
        .filter((m) => m.status === 'active')
        .map((m) => ({ user_id: m.user_id!, display_name: m.display_name ?? m.user_id! }))
    : [];

  return (
    <MealLogger
      householdMembers={members}
      householdId={household?.id ?? null}
      defaultShareState={shareDefault}
    />
  );
}
