import { Suspense } from 'react';
import { SettingsLayout } from './SettingsLayout';
import { ProfileSettings } from '@/components/specific/ProfileSettings';
import { HouseholdSettings } from '@/components/specific/HouseholdSettings';
import { LogPipelinePreference } from '@/components/specific/LogPipelinePreference';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getShareDefault, getChatPanelSide, getChatPanelDefaultOpen } from '@/actions/profile';
import { getPreferences } from '@/actions/preferences';
import { getUserLang } from '@/lib/i18n/server';
import { SHADOW_V1_ENABLED } from '@/lib/ai/log-v2/config';

export default async function SettingsPage() {
  const [shareDefault, chatPanelSide, chatPanelDefaultOpen, preferences, lang] = await Promise.all([
    getShareDefault(),
    getChatPanelSide(),
    getChatPanelDefaultOpen(),
    getPreferences(),
    getUserLang(),
  ]);

  return (
    <SettingsLayout>
      <ProfileSettings
        initialShareDefault={shareDefault}
        initialChatPanelSide={chatPanelSide}
        initialChatPanelDefaultOpen={chatPanelDefaultOpen}
      />
      <LogPipelinePreference
        initialValue={preferences.effectivePipeline}
        offerShadow={SHADOW_V1_ENABLED && preferences.isDeveloper}
        lang={lang}
      />
      <Suspense fallback={<SkeletonCard />}>
        <HouseholdSettings />
      </Suspense>
    </SettingsLayout>
  );
}
