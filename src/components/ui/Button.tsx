'use client';

import styled, { css } from 'styled-components';
import { theme, alpha } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS = {
  primary: css`
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border: 1px solid ${theme.colors.primary};
    &:hover:not(:disabled) { background: ${theme.colors.primaryHover}; box-shadow: 0 4px 12px ${alpha(theme.colors.primary, 0.3)}; }
  `,
  secondary: css`
    background: transparent;
    color: ${theme.colors.primaryBright};
    border: 1px solid ${theme.colors.primary};
    &:hover:not(:disabled) { background: ${alpha(theme.colors.primary, 0.1)}; }
  `,
  ghost: css`
    background: transparent;
    color: ${theme.colors.textSecondary};
    border: 1px solid transparent;
    &:hover:not(:disabled) { color: ${theme.colors.text}; background: ${theme.colors.surfaceHigh}; }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant; $size?: 'sm' | 'md' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: ${(p) => (p.$size === 'sm' ? '0.3rem 0.7rem' : '0.55rem 1.1rem')};
  border-radius: ${theme.radii.full};
  font-size: ${(p) => (p.$size === 'sm' ? '0.8rem' : '0.9rem')};
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  ${(p) => VARIANTS[p.$variant ?? 'primary']}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
