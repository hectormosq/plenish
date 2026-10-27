'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { createHousehold } from '@/actions/households';
import { Home } from 'lucide-react';
import { theme } from '@/theme';

const Prompt = styled.p`
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const NameInput = styled.input`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.md};
  padding: 0.6rem 0.875rem;
  color: ${theme.colors.text};
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;

  &::placeholder { color: ${theme.colors.textMuted}; }
  &:focus { outline: none; border-color: ${theme.colors.primary}; }
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: ${theme.colors.primary};
  color: ${theme.colors.onPrimary};
  border: none;
  border-radius: ${theme.radii.md};
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-start;

  &:hover { background: ${theme.colors.primaryHover}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorText = styled.p`
  color: ${theme.colors.dangerBright};
  font-size: 0.8rem;
  margin: 0;
`;

export function CreateHouseholdForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createHousehold(name.trim());
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <Prompt>You are not part of a household yet. Create one to share meals with others.</Prompt>
      <Form>
        <NameInput
          type="text"
          placeholder="Household name (e.g. Casa García)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <CreateButton onClick={handleCreate} disabled={isPending || !name.trim()}>
          <Home size={14} />
          Create Household
        </CreateButton>
      </Form>
    </>
  );
}
