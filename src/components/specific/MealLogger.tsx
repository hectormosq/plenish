'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import styled, { keyframes } from 'styled-components';
import type { MealType } from '@/actions/meals';
import type { HouseholdMemberSimple } from '@/actions/households';
import { Send, Loader2, X, Pencil } from 'lucide-react';
import { MemberPickerPopover } from '@/components/specific/MemberPickerPopover';
import { useSessionLogger } from 'ai-session-logger/next';
import { MealDraftTable } from '@/components/specific/MealDraftTable';
import { draftOfPart } from '@/lib/ai/log-v2/draft-parts';
import { buildReply } from '@/lib/ai/log-v2/reply';
import type { MealDraft, PlenishUIMessage } from '@/lib/ai/log-v2/schemas';
import { theme, alpha } from '@/theme';
import { MEAL_TYPES } from '@/lib/meal-types';
import { t } from '@/lib/i18n';

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
    background: ${theme.colors.surfaceHighest};
    border-radius: ${theme.radii.sm};
  }
`;

const MessageBubble = styled.div<{ $role: 'user' | 'assistant'; $wide?: boolean }>`
  max-width: ${(props) => (props.$wide ? 'min(100%, 32rem)' : '80%')};
  width: ${(props) => (props.$wide ? '100%' : 'auto')};
  box-sizing: border-box;
  padding: 1rem;
  border-radius: ${theme.radii.lg};
  line-height: 1.5;
  font-size: 0.95rem;

  ${(props) =>
    props.$role === 'user'
      ? `
      align-self: flex-end;
      background-color: ${theme.colors.primary};
      color: ${theme.colors.onPrimary};
      border-bottom-right-radius: 2px;
    `
      : `
      align-self: flex-start;
      background-color: ${theme.colors.surfaceHigh};
      border: 1px solid ${theme.colors.borderStrong};
      color: ${theme.colors.text};
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
  color: ${theme.colors.textFaint};
  font-size: 1rem;
  user-select: none;
  padding: 0 0.25rem;
`;

const DateChip = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? alpha(theme.colors.violet, 0.15) : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? theme.colors.violet : theme.colors.border)};
  color: ${({ $active }) => ($active ? theme.colors.violet : theme.colors.textSecondary)};
  padding: 0.5rem 1rem;
  border-radius: ${theme.radii.xl};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.violet};
    color: ${theme.colors.violet};
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
  background: ${({ $active }) => ($active ? theme.colors.primary : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  color: ${({ $active }) => ($active ? theme.colors.onPrimary : theme.colors.textSecondary)};
  padding: 0.5rem 1rem;
  border-radius: ${theme.radii.xl};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.primary};
    color: ${({ $active }) => ($active ? theme.colors.onPrimary : theme.colors.primary)};
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
  background-color: ${theme.colors.surfaceHigh};
  border: 1px solid ${theme.colors.borderStrong};
  color: ${theme.colors.text};
  padding: 0.75rem 1rem;
  border-radius: ${theme.radii.xl};
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
    border-color: ${theme.colors.primary};
  }

  &::placeholder {
    color: ${theme.colors.textMuted};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  background-color: ${theme.colors.primary};
  color: ${theme.colors.onPrimary};
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
    background-color: ${theme.colors.primaryHover};
    transform: scale(1.05);
  }

  &:disabled {
    background-color: ${theme.colors.surfaceHighest};
    color: ${theme.colors.textMuted};
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
    $state === 'just-me' ? 'transparent' : alpha(theme.colors.primary, 0.15)};
  border: 1px solid ${({ $state }) => ($state === 'just-me' ? theme.colors.border : theme.colors.primary)};
  color: ${({ $state }) => ($state === 'just-me' ? theme.colors.textSecondary : theme.colors.primaryBright)};
  border-radius: ${theme.radii.xl};
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
    border-color: ${theme.colors.primary};
    color: ${theme.colors.primaryBright};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.textMuted};
  cursor: pointer;
  padding: 0.25rem;
  margin-left: 2px;
  display: flex;
  align-items: center;
  border-radius: ${theme.radii.sm};
  transition: color 0.2s;

  &:hover {
    color: ${theme.colors.primaryBright};
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

function buildIntroMessage(initialMealType?: MealType, initialDate?: string): string {
  if (initialMealType) {
    const mealLabel = t('es', `mealType.${initialMealType}`);
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
  const { messages, status, error, sendMessage, setMessages } = useChat<PlenishUIMessage>({ transport: chatTransport });

  // After a save from the table, write the server's version back into the conversation,
  // so the next request carries the saved table (the server reads it from the messages).
  // A direct v2 reply's template text is swapped too, so it no longer asks to save.
  const replaceTable = (messageIndex: number, next: MealDraft) =>
    setMessages((prev) => prev.map((m, i) => i !== messageIndex ? m : {
      ...m,
      parts: m.parts.map((part) => {
        if (part.type === 'text' && next.status === 'saved' && m.parts.some((p) => p.type === 'data-meal-draft')) {
          return { ...part, text: buildReply('saved', next, next.language) };
        }
        if (part.type === 'data-meal-draft') return { ...part, data: next };
        if (part.type === 'tool-log_meal_v2' && part.state === 'output-available') {
          return { ...part, output: { ...(part.output as object), draft: next } };
        }
        return part;
      }),
    }));
  // Only a table in the last assistant message can still be edited or saved.
  const lastAssistantIndex = useMemo(() => messages.findLastIndex((m) => m.role === 'assistant'), [messages]);
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
      const savedTable = lastAssistant?.parts.some((p) => draftOfPart(p)?.status === 'saved');
      if (lastAssistant?.parts.some(isToolUIPart) || savedTable) {
        router.refresh();
      }
    }
  }, [status, messages, router]);

  const [localInput, setLocalInput] = useState(initialText ?? '');
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(initialMealType ?? null);
  // null = let AI infer from text; YYYY-MM-DD string = explicit date
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);

  // Sync controls when prefill props arrive while the panel is already mounted
  useEffect(() => {
    if (initialMealType) setSelectedMealType(initialMealType);
  }, [initialMealType]);

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);
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

    // What the form already knows travels as request fields, not as text the
    // AI has to parse. The server applies these values when the meal is saved.
    // FR-007: co-eater context so the meal is logged as shared correctly.
    const logContext = {
      mealType: selectedMealType,
      date: selectedDate && selectedDate !== todayISO() ? selectedDate : null,
      shareState,
      coEaterIds: shareState === 'partial' ? [...selectedCoEaters] : null,
    };

    session.userMessage(localInput, {
      mealType: selectedMealType,
      date: selectedDate ?? todayISO(),
      shareState,
    });
    sendMessage({ text: localInput }, { body: { logContext } });
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
        {messages.map((m: PlenishUIMessage, i: number) => {
          const content = m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? '';
          // v2 meal tables: one per message at most (the last version wins).
          const tables = m.parts.map(draftOfPart).filter((d): d is MealDraft => d !== null);
          const table = tables.at(-1);
          const shown = table ?? null;
          if (!content && !shown) return null;
          return (
            <MessageBubble key={m.id ?? i} $role={m.role as 'user' | 'assistant'} $wide={Boolean(shown)}>
              {content}
              {shown && (
                <MealDraftTable
                  key={`${shown.run_id}-${shown.status}-${shown.meal_id ?? ''}`}
                  draft={shown}
                  isLatest={i === lastAssistantIndex && !isLoading}
                  onChange={(next) => replaceTable(i, next)}
                />
              )}
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
              color: theme.colors.danger,
              fontSize: '0.875rem',
              padding: '1rem',
              border: `1px solid ${theme.colors.danger}`,
              borderRadius: theme.radii.md,
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
            {t('es', `mealSlot.${type}`)}
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
