'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import styled, { keyframes } from 'styled-components';
import { logMeal, MealType } from '@/actions/meals';
import type { HouseholdMemberSimple } from '@/actions/households';
import { MessageSquare, Send, Loader2, X } from 'lucide-react';

// ─── Styled Components (from AIChatBox) ────────────────────────────────────

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 600px;
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
  margin-bottom: 1rem;
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }
`;

const MessageBubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: 80%;
  padding: 1rem;
  border-radius: 12px;
  line-height: 1.5;
  font-size: 0.95rem;

  ${(props) =>
    props.$role === 'user'
      ? `
      align-self: flex-end;
      background-color: #3b82f6;
      color: white;
      border-bottom-right-radius: 2px;
    `
      : `
      align-self: flex-start;
      background-color: #2a2a2a;
      border: 1px solid #444;
      color: #e5e5e5;
      border-bottom-left-radius: 2px;
    `}
`;

// ─── NEW: Meal Type Chips ──────────────────────────────────────────────────

const ChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0 0.5rem 0;
  flex-wrap: wrap;
`;

const ChipSeparator = styled.span`
  color: #444;
  font-size: 1rem;
  user-select: none;
  padding: 0 0.25rem;
`;

const MealTypeChip = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? '#3b82f6' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#3b82f6' : '#333')};
  color: ${({ $active }) => ($active ? '#fff' : '#999')};
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;

  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ─── Input Form Area ──────────────────────────────────────────────────────

const InputForm = styled.form`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  align-items: center;
`;

const ChatInput = styled.input`
  flex: 1;
  background-color: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 1rem;
  border-radius: 9999px;
  outline: none;
  font-family: inherit;
  font-size: 1rem;

  &:focus {
    border-color: #3b82f6;
  }

  &::placeholder {
    color: #666;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  background-color: #3b82f6;
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background-color: #2563eb;
    transform: scale(1.05);
  }

  &:disabled {
    background-color: #444;
    cursor: not-allowed;
    transform: none;
  }

  svg.spinner {
    animation: spin 1s linear infinite;
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// ─── NEW: 3-State Share Button (visual, logic in Phase 3) ────────────────

const ShareButton = styled.button<{ $state: 'just-me' | 'all' | 'partial' }>`
  background: ${({ $state }) =>
    $state === 'just-me' ? 'transparent' : 'rgba(59, 130, 246, 0.15)'};
  border: 1px solid ${({ $state }) => ($state === 'just-me' ? '#333' : '#3b82f6')};
  color: ${({ $state }) => ($state === 'just-me' ? '#999' : '#93c5fd')};
  border-radius: 20px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    border-color: #3b82f6;
    color: #93c5fd;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────

interface MealLoggerProps {
  householdMembers?: HouseholdMemberSimple[];
  householdId?: string | null;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

export function MealLogger({
  householdMembers = [],
  householdId = null,
}: MealLoggerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Chat State (from AIChatBox) ─────────────────────────────────

  const { messages, status, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      body: { tzOffset: new Date().getTimezoneOffset() },
    }),
  });
  const isLoading = status === 'streaming' || status === 'submitted';
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, error]);

  // ─── Form State (from LogMealForm) ──────────────────────────────

  const [localInput, setLocalInput] = useState('');
  // null = no chip selected (chat mode); set = meal log mode
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [shareState, setShareState] = useState<'just-me' | 'all' | 'partial'>(
    'just-me'
  );
  const [selectedCoEaters, setSelectedCoEaters] = useState<Set<string>>(
    new Set()
  );

  // ─── Event Handlers ─────────────────────────────────────────────

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    if (selectedMealType) {
      // Chip selected → log meal directly via server action
      startTransition(async () => {
        try {
          await logMeal(
            localInput,
            selectedMealType,
            shareState !== 'just-me' && householdId
              ? {
                  isShared: true,
                  householdId,
                  coEaterIds: Array.from(selectedCoEaters),
                }
              : undefined
          );
          setLocalInput('');
          setSelectedMealType(null);
          setShareState('just-me');
          setSelectedCoEaters(new Set());
          router.refresh();
        } catch (err) {
          console.error('Failed to log meal:', err);
        }
      });
    } else {
      // No chip selected → send to AI chat
      sendMessage({ text: localInput });
      setLocalInput('');
    }
  };

  const handleChipClick = (type: MealType) => {
    // Toggle: clicking the active chip deselects it (back to chat mode)
    setSelectedMealType((prev) => (prev === type ? null : type));
  };

  const handleShareClick = () => {
    // Phase 1: Simple cycling (just-me → all → just-me)
    // Phase 3: Add member picker popover
    if (shareState === 'just-me') {
      setShareState('all');
      setSelectedCoEaters(new Set(householdMembers.map((m) => m.user_id)));
    } else {
      setShareState('just-me');
      setSelectedCoEaters(new Set());
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <ChatContainer>
      {/* Header */}
      <HeaderRow>
        <MessageSquare size={24} color="#a855f7" />
        <span style={{ color: '#a855f7', fontWeight: 600, fontSize: '1.125rem' }}>
          Plenish Agent
        </span>
      </HeaderRow>

      {/* Message List */}
      <MessageList>
        {/* Initial greeting */}
        <MessageBubble $role="assistant">
          ¡Hola! Soy tu asistente de Plenish. ¿Qué comiste hoy o necesitas ayuda
          planificando tu semana?
        </MessageBubble>

        {/* Chat messages */}
        {messages.map((m: UIMessage, i: number) => {
          const content = m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? '';
          return (
            <MessageBubble key={m.id ?? i} $role={m.role as 'user' | 'assistant'}>
              {content}
            </MessageBubble>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <MessageBubble $role="assistant">
            <em>Pensando...</em>
          </MessageBubble>
        )}

        {/* Error display */}
        {error && (
          <div
            style={{
              color: '#ef4444',
              fontSize: '0.875rem',
              padding: '1rem',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              marginTop: '0.5rem',
            }}
          >
            <strong>Error:</strong> {error.message || 'An error occurred.'}
          </div>
        )}

        {/* Auto-scroll target */}
        <div ref={endOfMessagesRef} />
      </MessageList>

      {/* Meal Type Chips + Share Selector */}
      <ChipRow>
        {MEAL_TYPES.map((type) => (
          <MealTypeChip
            key={type}
            $active={selectedMealType === type}
            onClick={() => handleChipClick(type)}
            disabled={isPending || isLoading}
            type="button"
            title={selectedMealType === type ? 'Click to deselect (switch to chat)' : `Log as ${type}`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            {selectedMealType === type && <X size={12} style={{ marginLeft: '4px' }} />}
          </MealTypeChip>
        ))}

        {householdMembers.length > 0 && (
          <>
            <ChipSeparator>|</ChipSeparator>
            <ShareButton
              type="button"
              $state={shareState}
              onClick={handleShareClick}
              disabled={isPending || isLoading}
              title="Who sees this meal?"
            >
              {shareState === 'just-me' ? '👤 Just me' : shareState === 'all' ? '👥 All' : '👥 Partial'}
            </ShareButton>
          </>
        )}
      </ChipRow>

      {/* Input Form */}
      <InputForm onSubmit={handleFormSubmit}>
        <ChatInput
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          placeholder={
            selectedMealType
              ? `Describe your ${selectedMealType}...`
              : 'Ask me anything or select a meal type to log...'
          }
          disabled={isPending || isLoading}
        />

        {/* Send Button */}
        <SendButton
          type="submit"
          disabled={isPending || isLoading || !localInput.trim()}
          title="Submit"
        >
          {isPending || isLoading ? (
            <Loader2 className="spinner" size={18} />
          ) : (
            <Send size={18} />
          )}
        </SendButton>
      </InputForm>
    </ChatContainer>
  );
}
