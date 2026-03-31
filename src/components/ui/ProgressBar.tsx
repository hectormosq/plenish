'use client';

import styled from 'styled-components';
import React from 'react';

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
  color: #a3a3a3;
`;

const ValueSpan = styled.span<{ $isOverLimit: boolean; $type: ProgressType }>`
  font-weight: 600;
  color: ${(props) => {
    if (props.$type === 'limit' && props.$isOverLimit) return '#ef4444'; // Red
    return '#f5f5f5'; // Default white
  }};
`;

const Track = styled.div`
  width: 100%;
  height: 8px;
  background-color: #333;
  border-radius: 9999px;
  overflow: hidden;
`;

const Fill = styled.div<{ $percentage: number; $color: string }>`
  height: 100%;
  width: ${(props) => Math.min(props.$percentage, 100)}%;
  background-color: ${(props) => props.$color};
  border-radius: 9999px;
  transition: width 0.5s ease-out, background-color 0.3s ease;
`;

export function ProgressBar({ current, max, type = 'target', label }: ProgressBarProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOverLimit = current >= max;

  // Determine fill color
  let color = '#10b981'; // Default Green for targets
  
  if (type === 'limit') {
    if (percentage < 50) color = '#10b981'; // Green
    else if (percentage < 85) color = '#f59e0b'; // Orange/Yellow
    else color = '#ef4444'; // Red (Danger)
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
