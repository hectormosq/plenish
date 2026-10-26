'use client';

import styled from 'styled-components';

export type BadgeTone = 'neutral' | 'accent' | 'success';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: '#2f2f2f', fg: '#a3a3a3' },
  accent:  { bg: 'rgba(99, 102, 241, 0.18)', fg: '#a5b4fc' },
  success: { bg: 'rgba(52, 211, 153, 0.15)', fg: '#6ee7b7' },
};

/** Small inline label, e.g. the source of a value. */
export const Badge = styled.span<{ $tone?: BadgeTone }>`
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: ${(p) => TONES[p.$tone ?? 'neutral'].bg};
  color: ${(p) => TONES[p.$tone ?? 'neutral'].fg};
`;
