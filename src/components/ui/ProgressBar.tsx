'use client';

import styled from 'styled-components';
import React from 'react';
import { theme } from '@/theme';

type ProgressType = 'target' | 'limit';

interface ProgressBarProps {
  current: number;
  max: number;
  type?: ProgressType;
  label: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`;

const LabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: ${theme.colors.textSecondary};
`;

const ValueSpan = styled.span<{ $isOverLimit: boolean; $type: ProgressType }>`
  font-weight: 600;
  color: ${(props) => {
    if (props.$type === 'limit' && props.$isOverLimit) return theme.colors.danger; // Red
    return theme.colors.text; // Default white
  }};
`;

const Track = styled.div`
  width: 100%;
  height: 8px;
  background-color: ${theme.colors.surfaceHighest};
  border-radius: ${theme.radii.full};
  overflow: hidden;
`;

const Fill = styled.div<{ $percentage: number; $color: string }>`
  height: 100%;
  width: ${(props) => Math.min(props.$percentage, 100)}%;
  background-color: ${(props) => props.$color};
  border-radius: ${theme.radii.full};
  transition: width 0.5s ease-out, background-color 0.3s ease;
`;

export function ProgressBar({ current, max, type = 'target', label }: ProgressBarProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOverLimit = current >= max;

  // Determine fill color
  let color = theme.colors.primary; // Default Green for targets
  
  if (type === 'limit') {
    if (percentage < 50) color = theme.colors.primary; // Green
    else if (percentage < 85) color = theme.colors.secondary; // Orange/Yellow
    else color = theme.colors.danger; // Red (Danger)
  }

  return (
    <Container>
      <LabelRow>
        <span>{label}</span>
        <ValueSpan $isOverLimit={isOverLimit} $type={type}>
          {current} / {max}
        </ValueSpan>
      </LabelRow>
      <Track>
        <Fill $percentage={percentage} $color={color} />
      </Track>
    </Container>
  );
}
