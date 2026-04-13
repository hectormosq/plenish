import { Suspense } from 'react';
import { SettingsLayout } from './SettingsLayout';
import { ProfileSettings } from '@/components/specific/ProfileSettings';
import { HouseholdSettings } from '@/components/specific/HouseholdSettings';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getShareDefault } from '@/actions/profile';

export default async function SettingsPage() {
  const shareDefault = await getShareDefault();

  return (
    <SettingsLayout>
      <ProfileSettings initialShareDefault={shareDefault} />
      <Suspense fallback={<SkeletonCard />}>
        <HouseholdSettings />
      </Suspense>
    </SettingsLayout>
  );
}
