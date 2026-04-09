import React from 'react';
import { getHousehold } from '@/actions/households';
import { LogMealForm } from './LogMealForm';

/**
 * Async server component that fetches the user's household members
 * and passes them to LogMealForm so co-eater selection can be shown.
 */
export async function LogMealFormWrapper() {
  const household = await getHousehold();

  const members = household
    ? household.members
        .filter((m) => m.status === 'active')
        .map((m) => ({ user_id: m.user_id!, display_name: m.display_name ?? m.user_id! }))
    : [];

  return (
    <LogMealForm
      householdMembers={members}
      householdId={household?.id ?? null}
    />
  );
}
