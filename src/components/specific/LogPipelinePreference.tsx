'use client';

import { useState, useTransition } from 'react';
import styled from 'styled-components';
import { Sparkles } from 'lucide-react';
import { setLogPipeline } from '@/actions/preferences';
import { Card, CardTitle } from '@/components/ui/Card';
import { RadioCardGroup } from '@/components/ui/RadioCardGroup';
import type { RadioCardOption } from '@/components/ui/RadioCardGroup';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { LogPipeline } from '@/lib/ai/log-v2/preferences';
import { theme } from '@/theme';

const SavedText = styled.p`
  margin: 0;
  font-size: 0.775rem;
  color: ${theme.colors.textMuted};
`;

const ErrorText = styled.p`
  margin: 0;
  font-size: 0.775rem;
  color: ${theme.colors.dangerBright};
`;

interface Props {
  initialValue: LogPipeline;
  /** Shadow mode is offered only to whitelisted developers, once shadow runs exist. */
  offerShadow: boolean;
  lang: Lang;
}

export function LogPipelinePreference({ initialValue, offerShadow, lang }: Props) {
  const [value, setValue] = useState<LogPipeline>(initialValue);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const options: RadioCardOption<LogPipeline>[] = [
    { value: 'v1', label: t(lang, 'preferences.logPipeline.v1'), description: t(lang, 'preferences.logPipeline.v1.desc') },
    { value: 'v2', label: t(lang, 'preferences.logPipeline.v2'), description: t(lang, 'preferences.logPipeline.v2.desc') },
  ];
  if (offerShadow) {
    options.push({ value: 'v2_shadow_v1', label: t(lang, 'preferences.logPipeline.shadow'), description: t(lang, 'preferences.logPipeline.shadow.desc') });
  }

  function handleChange(next: LogPipeline) {
    if (next === value || isPending) return;
    const previous = value;
    setValue(next);
    setStatus('idle');
    startTransition(async () => {
      const result = await setLogPipeline(next);
      if (result.ok) {
        setStatus('saved');
      } else {
        setValue(previous);
        setStatus('error');
      }
    });
  }

  return (
    <Card>
      <CardTitle>
        <Sparkles size={20} style={{ color: theme.colors.primary }} />
        {t(lang, 'preferences.logPipeline.title')}
      </CardTitle>
      <RadioCardGroup
        options={options}
        value={value}
        onChange={handleChange}
        disabled={isPending}
        aria-label={t(lang, 'preferences.logPipeline.title')}
      />
      {status === 'saved' && <SavedText>{t(lang, 'preferences.saved')}</SavedText>}
      {status === 'error' && <ErrorText>{t(lang, 'preferences.error')}</ErrorText>}
    </Card>
  );
}
