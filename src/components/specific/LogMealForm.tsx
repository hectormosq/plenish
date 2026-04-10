'use client';

/**
 * @deprecated Use MealLogger instead (Phase 1: 004-ui-chat-form-merge)
 * This component has been consolidated into MealLogger.tsx which combines
 * chat + meal logging into a unified interface.
 * Keeping this file for reference; can be deleted in Phase 2+.
 */

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled, { keyframes, css } from 'styled-components';
import { logMeal, MealType } from '@/actions/meals';
import type { HouseholdMemberSimple } from '@/actions/households';
import { Card, CardTitle } from '@/components/ui/Card';
import { PlusCircle, Loader2, Users } from 'lucide-react';

const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  color: #a3a3a3;
  font-weight: 500;
`;

const TextInput = styled.input`
  background-color: #222;
  border: 1px solid #333;
  color: #fff;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }

  &::placeholder {
    color: #555;
  }
`;

const SelectInput = styled.select`
  background-color: #222;
  border: 1px solid #333;
  color: #fff;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  appearance: none;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #10b981;
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const SubmitButton = styled.button<{ $loading?: boolean }>`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 0.875rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  ${props => props.$loading && css`
    opacity: 0.7;
    cursor: not-allowed;
    transform: none !important;
  `}

  svg.spinner {
    animation: ${spin} 1s linear infinite;
  }
`;

// ─── Household share controls ─────────────────────────────────────────────────

const ShareToggle = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: ${({ $active }) => ($active ? 'rgba(59,130,246,0.15)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#3b82f6' : '#333')};
  color: ${({ $active }) => ($active ? '#93c5fd' : '#6b7280')};
  border-radius: 8px;
  padding: 0.45rem 0.875rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;

  &:hover { border-color: #3b82f6; color: #93c5fd; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const MemberCheckboxList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
`;

const MemberCheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #d1d5db;
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  background: #1a1a1a;

  input[type='checkbox'] { accent-color: #3b82f6; }
`;

interface LogMealFormProps {
  householdMembers?: HouseholdMemberSimple[];
  householdId?: string | null;
}

export function LogMealForm({ householdMembers = [], householdId = null }: LogMealFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [logText, setLogText] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedCoEaters, setSelectedCoEaters] = useState<Set<string>>(new Set());

  const toggleCoEater = (userId: string) => {
    setSelectedCoEaters((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logText.trim()) return;
    setErrorMsg('');

    startTransition(async () => {
      try {
        await logMeal(logText, mealType, isShared && householdId ? {
          isShared: true,
          householdId,
          coEaterIds: Array.from(selectedCoEaters),
        } : undefined);
        setLogText('');
        setIsShared(false);
        setSelectedCoEaters(new Set());
        router.refresh();
      } catch (e: unknown) {
        console.error('Failed to log meal:', e);
        setErrorMsg('Failed to log meal. Please try again.');
      }
    });
  };

  return (
    <Card>
      <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PlusCircle size={20} color="#10b981" />
        Log a Meal
      </CardTitle>
      
      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem' }}>
          {errorMsg}
        </div>
      )}

      <FormContainer onSubmit={handleSubmit}>
        <InputGroup>
          <Label htmlFor="mealType">Which meal was it?</Label>
          <SelectInput 
            id="mealType"
            value={mealType} 
            onChange={e => setMealType(e.target.value as MealType)}
            disabled={isPending}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </SelectInput>
        </InputGroup>

        <InputGroup>
          <Label htmlFor="logText">What did you eat?</Label>
          <TextInput 
            id="logText"
            placeholder="e.g. 2 eggs, avocado toast, and black coffee..."
            value={logText}
            onChange={e => setLogText(e.target.value)}
            disabled={isPending}
          />
        </InputGroup>

        {householdMembers.length > 0 && (
          <InputGroup>
            <ShareToggle
              type="button"
              $active={isShared}
              disabled={isPending}
              onClick={() => { setIsShared((v) => !v); setSelectedCoEaters(new Set()); }}
            >
              <Users size={13} />
              {isShared ? 'Sharing with household' : 'Share with household'}
            </ShareToggle>

            {isShared && (
              <MemberCheckboxList>
                {householdMembers.map((m) => (
                  <MemberCheckRow key={m.user_id}>
                    <input
                      type="checkbox"
                      checked={selectedCoEaters.has(m.user_id)}
                      onChange={() => toggleCoEater(m.user_id)}
                      disabled={isPending}
                    />
                    {m.display_name}
                  </MemberCheckRow>
                ))}
              </MemberCheckboxList>
            )}
          </InputGroup>
        )}

        <SubmitButton type="submit" $loading={isPending} disabled={isPending || !logText.trim()}>
          {isPending ? (
            <Loader2 className="spinner" size={18} />
          ) : (
            <PlusCircle size={18} />
          )}
          {isPending ? 'Logging...' : 'Save Meal'}
        </SubmitButton>
      </FormContainer>
    </Card>
  );
}
