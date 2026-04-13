'use client';

import React, { useState, useTransition } from 'react';
import styled from 'styled-components';
import { updateShareDefault } from '@/actions/profile';
import { User } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const SettingLabel = styled.div`
  font-size: 0.9rem;
  color: #d1d5db;
`;

const SettingHint = styled.div`
  font-size: 0.775rem;
  color: #6b7280;
  margin-top: 0.2rem;
`;

const ToggleGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const ToggleChip = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? 'rgba(59,130,246,0.15)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#3b82f6' : '#333')};
  color: ${({ $active }) => ($active ? '#93c5fd' : '#6b7280')};
  border-radius: 20px;
  padding: 0.4rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;

  &:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #93c5fd;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const SavedText = styled.p`
  margin: 0;
  font-size: 0.775rem;
  color: #4b5563;
`;

const ErrorText = styled.p`
  margin: 0;
  font-size: 0.775rem;
  color: #f87171;
`;

interface Props {
  initialShareDefault: 'just-me' | 'all';
}

export function ProfileSettings({ initialShareDefault }: Props) {
  const [shareDefault, setShareDefault] = useState<'just-me' | 'all'>(initialShareDefault);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = (value: 'just-me' | 'all') => {
    if (value === shareDefault || isPending) return;
    setShareDefault(value);
    setSaved(false);
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateShareDefault(value);
        setSaved(true);
      } catch (e) {
        setSaveError((e as Error).message);
        setShareDefault(shareDefault); // revert optimistic update
      }
    });
  };

  return (
    <Card>
      <CardTitle>
        <User size={20} color="#a855f7" />
        Profile
      </CardTitle>
      <SettingRow>
        <div>
          <SettingLabel>Default sharing</SettingLabel>
          <SettingHint>Initial state of the share button when logging a meal</SettingHint>
        </div>
        <ToggleGroup>
          <ToggleChip
            $active={shareDefault === 'just-me'}
            onClick={() => handleChange('just-me')}
            disabled={isPending}
          >
            👤 Just me
          </ToggleChip>
          <ToggleChip
            $active={shareDefault === 'all'}
            onClick={() => handleChange('all')}
            disabled={isPending}
          >
            👥 All
          </ToggleChip>
        </ToggleGroup>
      </SettingRow>
      {saved && <SavedText>Saved.</SavedText>}
      {saveError && <ErrorText>{saveError}</ErrorText>}
    </Card>
  );
}
