'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { createHousehold } from '@/actions/households';
import { Home } from 'lucide-react';

const Prompt = styled.p`
  margin: 0;
  color: #9ca3af;
  font-size: 0.9rem;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const NameInput = styled.input`
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.6rem 0.875rem;
  color: #f5f5f5;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;

  &::placeholder { color: #555; }
  &:focus { outline: none; border-color: #3b82f6; }
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-start;

  &:hover { background: #2563eb; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorText = styled.p`
  color: #f87171;
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
