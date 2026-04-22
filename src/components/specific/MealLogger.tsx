'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import type { UIMessage } from 'ai';
import styled, { keyframes } from 'styled-components';
import type { MealType } from '@/actions/meals';
import type { HouseholdMemberSimple } from '@/actions/households';
import { Send, Loader2, X, Pencil } from 'lucide-react';
import { MemberPickerPopover } from '@/components/specific/MemberPickerPopover';
import { useSessionLogger } from 'ai-session-logger/next';

// ─── Styled Components (from AIChatBox) ────────────────────────────────────

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: transparent;
  padding: 0.75rem 0 0;
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

const DateChip = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? 'rgba(168, 85, 247, 0.15)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#a855f7' : '#333')};
  color: ${({ $active }) => ($active ? '#d8b4fe' : '#999')};
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &:hover:not(:disabled) {
    border-color: #a855f7;
    color: #d8b4fe;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const HiddenDateInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
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

  &:hover:not(:disabled) {
    border-color: #3b82f6;
    color: ${({ $active }) => ($active ? '#fff' : '#3b82f6')};
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
  align-items: flex-end;
`;

const ChatTextarea = styled.textarea`
  flex: 1;
  background-color: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  outline: none;
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  overflow-y: auto;
  min-height: 5rem;
  max-height: 12rem;
  line-height: 1.5;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

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

// ─── 3-State Share Button (Phase 3) ──────────────────────────────────────

const ShareButtonWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

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

const EditIconButton = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0.25rem;
  margin-left: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: color 0.2s;

  &:hover {
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
  defaultShareState?: 'just-me' | 'all';
  initialMealType?: MealType;
  initialText?: string;
  initialDate?: string;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

const MEAL_LABELS_ES: Record<string, string> = {
  breakfast: 'desayuno',
  snack: 'merienda',
  lunch: 'almuerzo',
  dinner: 'cena',
};

function buildIntroMessage(initialMealType?: string, initialDate?: string): string {
  if (initialMealType) {
    const mealLabel = MEAL_LABELS_ES[initialMealType] ?? initialMealType;
    const datePart = initialDate ? ` del ${initialDate}` : '';
    return `¡Hola! Vamos a registrar tu ${mealLabel}${datePart}. ¿Qué comiste?`;
  }
  return '¡Hola! Soy tu asistente de Plenish. ¿Qué comiste hoy o necesitas ayuda planificando tu semana?';
}

export function MealLogger({
  householdMembers = [],
  defaultShareState = 'all',
  initialMealType,
  initialText,
  initialDate,
}: MealLoggerProps) {
  const router = useRouter();
  const prevStatusRef = useRef<string>('');
  const { session } = useSessionLogger();
  const chatTransport = useMemo(
    () => new DefaultChatTransport({
      body: { tzOffset: new Date().getTimezoneOffset(), sessionId: session.sessionId },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { messages, status, error, sendMessage } = useChat({ transport: chatTransport });
  const isLoading = status === 'streaming' || status === 'submitted';
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, error]);


  // Clear prefill URL params after mount so they don't persist on refresh
  useEffect(() => {
    if (initialText) {
      router.replace('/dashboard');
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the calendar after the AI completes a tool-calling response
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if ((prev === 'streaming' || prev === 'submitted') && status === 'ready') {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant?.parts.some(isToolUIPart)) {
        router.refresh();
      }
    }
  }, [status, messages, router]);

  const [localInput, setLocalInput] = useState(initialText ?? '');
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(initialMealType ?? null);
  // null = let AI infer from text; YYYY-MM-DD string = explicit date
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [shareState, setShareState] = useState<'just-me' | 'all' | 'partial'>(defaultShareState);
  const [selectedCoEaters, setSelectedCoEaters] = useState<Set<string>>(
    defaultShareState === 'just-me' ? new Set() : new Set(householdMembers.map((m) => m.user_id))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // ─── Date helpers ────────────────────────────────────────────────

  const todayISO = (): string => new Date().toISOString().split('T')[0];
  const yesterdayISO = (): string =>
    new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

  const getDateLabel = (date: string | null): string => {
    if (!date || date === todayISO()) return 'Today';
    if (date === yesterdayISO()) return 'Yesterday';
    // e.g. "Apr 9"
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // ─── Share label helpers ─────────────────────────────────────────────

  const getShareLabel = (): string => {
    if (shareState === 'just-me') return '👤 Just me';
    if (shareState === 'all') return '👥 All';
    // partial — show names if ≤ 2, otherwise "X/Y"
    const names = householdMembers
      .filter((m) => selectedCoEaters.has(m.user_id))
      .map((m) => m.display_name.split(' ')[0]);
    if (names.length <= 2) return `👥 ${names.join(', ')}`;
    return `👥 ${names.length}/${householdMembers.length}`;
  };

  // ─── Event Handlers ─────────────────────────────────────────────────

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    // Build prefixes so the AI has explicit context. If absent, the AI
    // parses natural language ("ayer", "yesterday") or asks the user.
    const parts: string[] = [];
    if (selectedDate && selectedDate !== todayISO()) {
      parts.push(`[date: ${selectedDate}]`);
    }
    if (selectedMealType) {
      parts.push(`[${selectedMealType}]`);
    }
    // FR-007: pass co-eater context so the AI logs it shared correctly
    if (shareState === 'all') {
      parts.push('[shared with: all]');
    } else if (shareState === 'partial') {
      const names = householdMembers
        .filter((m) => selectedCoEaters.has(m.user_id))
        .map((m) => m.display_name);
      if (names.length > 0) parts.push(`[shared with: ${names.join(', ')}]`);
    }
    const text = parts.length > 0 ? `${parts.join(' ')} ${localInput}` : localInput;

    session.userMessage(localInput, {
      mealType: selectedMealType,
      date: selectedDate ?? todayISO(),
      shareState,
    });
    sendMessage({ text });
    setLocalInput('');
    setSelectedMealType(null);
    setSelectedDate(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleChipClick = (type: MealType) => {
    const next = selectedMealType === type ? null : type;
    session.buttonClick('meal_type_selected', { type, active: next !== null });
    setSelectedMealType(next);
  };

  const handleDateChipClick = () => {
    dateInputRef.current?.showPicker();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value || null;
    setSelectedDate(date);
    session.buttonClick('date_selected', { date: date ?? todayISO() });
  };

  // FR-001: primary click toggles just-me ↔ all (fast path)
  const handleShareClick = () => {
    const next = shareState === 'just-me' ? 'all' : 'just-me';
    session.buttonClick('share_toggled', { from: shareState, to: next });
    if (shareState === 'just-me') {
      setShareState('all');
      setSelectedCoEaters(new Set(householdMembers.map((m) => m.user_id)));
    } else {
      // all or partial → just-me
      setShareState('just-me');
      setSelectedCoEaters(new Set());
    }
    setPickerOpen(false);
  };

  // FR-002: edit icon opens MemberPickerPopover
  const handleEditIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerOpen((prev) => !prev);
  };

  // FR-005: confirm from picker determines state
  const handlePickerConfirm = (picked: Set<string>) => {
    setPickerOpen(false);
    let next: 'just-me' | 'all' | 'partial';
    if (picked.size === 0) {
      next = 'just-me';
      setShareState('just-me');
      setSelectedCoEaters(new Set());
    } else if (picked.size === householdMembers.length) {
      next = 'all';
      setShareState('all');
      setSelectedCoEaters(picked);
    } else {
      next = 'partial';
      setShareState('partial');
      setSelectedCoEaters(picked);
    }
    session.buttonClick('co_eaters_confirmed', { share_state: next, count: picked.size });
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <ChatContainer>
      {/* Message List */}
      <MessageList>
        {/* Initial greeting */}
        <MessageBubble $role="assistant">
          {buildIntroMessage(initialMealType, initialDate)}
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

      {/* Date + Meal Type Chips + Share Selector */}
      <ChipRow>
        {/* Date chip — clicking opens native calendar */}
        <div style={{ position: 'relative' }}>
          <DateChip
            type="button"
            $active={selectedDate !== null && selectedDate !== todayISO()}
            onClick={handleDateChipClick}
            disabled={isLoading}
            title="Select meal date"
          >
            📅 {getDateLabel(selectedDate)}
          </DateChip>
          <HiddenDateInput
            ref={dateInputRef}
            type="date"
            value={selectedDate ?? todayISO()}
            max={todayISO()}
            onChange={handleDateChange}
            tabIndex={-1}
          />
        </div>

        <ChipSeparator>|</ChipSeparator>

        {MEAL_TYPES.map((type) => (
          <MealTypeChip
            key={type}
            $active={selectedMealType === type}
            onClick={() => handleChipClick(type)}
            disabled={isLoading}
            type="button"
            title={selectedMealType === type ? 'Click to deselect' : `Log as ${type}`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            {selectedMealType === type && <X size={12} style={{ marginLeft: '4px' }} />}
          </MealTypeChip>
        ))}

        {householdMembers.length > 0 && (
          <>
            <ChipSeparator>|</ChipSeparator>
            <ShareButtonWrapper>
              <ShareButton
                type="button"
                $state={shareState}
                onClick={handleShareClick}
                disabled={isLoading}
                title={shareState === 'just-me' ? 'Click to share with all' : 'Click to set to just me'}
              >
                {getShareLabel()}
              </ShareButton>
              {/* Edit icon — visible when all or partial (FR-002) */}
              {shareState !== 'just-me' && (
                <EditIconButton
                  type="button"
                  onClick={handleEditIconClick}
                  disabled={isLoading}
                  title="Edit who's eating this"
                >
                  <Pencil size={13} />
                </EditIconButton>
              )}
              {/* Member picker popover (FR-003 – FR-005) */}
              {pickerOpen && (
                <MemberPickerPopover
                  members={householdMembers}
                  selected={selectedCoEaters}
                  onConfirm={handlePickerConfirm}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </ShareButtonWrapper>
          </>
        )}
      </ChipRow>

      {/* Input Form */}
      <InputForm onSubmit={handleFormSubmit}>
        <ChatTextarea
          ref={inputRef}
          value={localInput}
          onChange={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
            setLocalInput(e.target.value);
          }}
          placeholder={
            selectedMealType
              ? `Describe your ${selectedMealType}...`
              : 'Ask me anything or select a meal type to log...'
          }
          disabled={isLoading}
        />

        {/* Send Button */}
        <SendButton
          type="submit"
          disabled={isLoading || !localInput.trim()}
          title="Submit"
        >
          {isLoading ? (
            <Loader2 className="spinner" size={18} />
          ) : (
            <Send size={18} />
          )}
        </SendButton>
      </InputForm>
    </ChatContainer>
  );
}
