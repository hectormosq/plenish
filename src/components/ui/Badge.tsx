'use client';

import styled from 'styled-components';
import { theme, alpha } from '@/theme';

export type BadgeTone = 'neutral' | 'accent' | 'success';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: theme.colors.surfaceHigh, fg: theme.colors.textSecondary },
  accent:  { bg: alpha(theme.colors.indigo, 0.18), fg: theme.colors.indigo },
  success: { bg: alpha(theme.colors.primary, 0.15), fg: theme.colors.primaryBright },
};

/** Small inline label, e.g. the source of a value. */
export const Badge = styled.span<{ $tone?: BadgeTone }>`
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: ${theme.radii.full};
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: ${(p) => TONES[p.$tone ?? 'neutral'].bg};
  color: ${(p) => TONES[p.$tone ?? 'neutral'].fg};
`;
