'use client';

import styled from 'styled-components';
import { theme, alpha } from '@/theme';

export const Card = styled.div`
  background-color: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.xl};
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px ${alpha(theme.colors.shadow, 0.1)}, 0 2px 4px -1px ${alpha(theme.colors.shadow, 0.06)};
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: ${theme.colors.text};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;
