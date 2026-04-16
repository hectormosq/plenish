import { Suspense } from 'react';
import { SettingsLayout } from './SettingsLayout';
import { ProfileSettings } from '@/components/specific/ProfileSettings';
import { HouseholdSettings } from '@/components/specific/HouseholdSettings';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getShareDefault, getChatPanelSide, getChatPanelDefaultOpen } from '@/actions/profile';

export default async function SettingsPage() {
  const [shareDefault, chatPanelSide, chatPanelDefaultOpen] = await Promise.all([
    getShareDefault(),
    getChatPanelSide(),
    getChatPanelDefaultOpen(),
  ]);

  return (
    <SettingsLayout>
      <ProfileSettings
        initialShareDefault={shareDefault}
        initialChatPanelSide={chatPanelSide}
        initialChatPanelDefaultOpen={chatPanelDefaultOpen}
      />
      <Suspense fallback={<SkeletonCard />}>
        <HouseholdSettings />
      </Suspense>
    </SettingsLayout>
  );
}
