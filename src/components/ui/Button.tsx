'use client';

import styled, { css } from 'styled-components';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS = {
  primary: css`
    background: #3b82f6;
    color: #fff;
    border: 1px solid #3b82f6;
    &:hover:not(:disabled) { background: #2563eb; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
  `,
  secondary: css`
    background: transparent;
    color: #93c5fd;
    border: 1px solid #3b82f6;
    &:hover:not(:disabled) { background: rgba(59, 130, 246, 0.1); }
  `,
  ghost: css`
    background: transparent;
    color: #a3a3a3;
    border: 1px solid transparent;
    &:hover:not(:disabled) { color: #e5e5e5; background: #2f2f2f; }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant; $size?: 'sm' | 'md' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: ${(p) => (p.$size === 'sm' ? '0.3rem 0.7rem' : '0.55rem 1.1rem')};
  border-radius: 9999px;
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
