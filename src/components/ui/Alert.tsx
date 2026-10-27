'use client';

import React from 'react';
import styled from 'styled-components';
import { Info, TriangleAlert } from 'lucide-react';
import { theme, alpha } from '@/theme';

type Tone = 'info' | 'warning';

const TONES: Record<Tone, { bg: string; border: string; fg: string }> = {
  info:    { bg: alpha(theme.colors.info, 0.08), border: alpha(theme.colors.info, 0.35), fg: theme.colors.infoBright },
  warning: { bg: alpha(theme.colors.secondary, 0.08), border: alpha(theme.colors.secondary, 0.35), fg: theme.colors.secondaryBright },
};

const Box = styled.div<{ $tone: Tone; $compact: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: ${(p) => (p.$compact ? '0.15rem 0.5rem' : '0.5rem 0.75rem')};
  border-radius: ${(p) => (p.$compact ? theme.radii.full : theme.radii.md)};
  border: 1px solid ${(p) => TONES[p.$tone].border};
  background: ${(p) => TONES[p.$tone].bg};
  color: ${(p) => TONES[p.$tone].fg};
  font-size: ${(p) => (p.$compact ? '0.7rem' : '0.8rem')};
  line-height: 1.3;
  width: fit-content;
  max-width: 100%;
`;

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  /** Pill-sized variant for lists and calendar cells. */
  compact?: boolean;
}

export function Alert({ tone = 'info', compact = false, children, ...rest }: AlertProps) {
  const Icon = tone === 'warning' ? TriangleAlert : Info;
  return (
    <Box role="note" $tone={tone} $compact={compact} {...rest}>
      <Icon size={compact ? 11 : 14} aria-hidden />
      <span>{children}</span>
    </Box>
  );
}
