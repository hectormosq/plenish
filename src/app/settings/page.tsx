import { Suspense } from 'react';
import { SettingsLayout } from './SettingsLayout';
import { ProfileSettings } from '@/components/specific/ProfileSettings';
import { HouseholdSettings } from '@/components/specific/HouseholdSettings';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getShareDefault, getChatPanelSide } from '@/actions/profile';

export default async function SettingsPage() {
  const [shareDefault, chatPanelSide] = await Promise.all([
    getShareDefault(),
    getChatPanelSide(),
  ]);

  return (
    <SettingsLayout>
      <ProfileSettings initialShareDefault={shareDefault} initialChatPanelSide={chatPanelSide} />
      <Suspense fallback={<SkeletonCard />}>
        <HouseholdSettings />
      </Suspense>
    </SettingsLayout>
  );
}
