'use client';

import styled from 'styled-components';
import { theme } from '@/theme';

export const Card = styled.div`
  background-color: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.xl};
  padding: 1.5rem;
  box-shadow: ${theme.shadows.card};
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
