'use client';

import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import styled from 'styled-components';
import { theme, alpha } from '@/theme';

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  badge?: ReactNode;
}

interface Props<T extends string> {
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem 1rem;
  border-radius: ${theme.radii.lg};
  border: 1px solid ${({ $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background: ${({ $active }) => ($active ? alpha(theme.colors.primary, 0.1) : 'transparent')};
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primaryBright};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Dot = styled.span<{ $active: boolean }>`
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 0.15rem;
  border-radius: 50%;
  border: 2px solid ${({ $active }) => ($active ? theme.colors.primary : theme.colors.borderStrong)};
  box-shadow: inset 0 0 0 3px ${theme.colors.surfaceContainer};
  background: ${({ $active }) => ($active ? theme.colors.primary : 'transparent')};
  transition: all 0.15s;
`;

const Label = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  font-weight: 500;
  color: ${theme.colors.text};
`;

const Description = styled.span`
  display: block;
  margin-top: 0.2rem;
  font-size: 0.775rem;
  color: ${theme.colors.textMuted};
  line-height: 1.4;
`;

/** Single choice shown as cards with a label and an optional description. */
export function RadioCardGroup<T extends string>({ options, value, onChange, disabled, 'aria-label': ariaLabel }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <Group role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Option
            key={option.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            $active={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <Dot $active={active} />
            <span>
              <Label>{option.label}{option.badge}</Label>
              {option.description && <Description>{option.description}</Description>}
            </span>
          </Option>
        );
      })}
    </Group>
  );
}
