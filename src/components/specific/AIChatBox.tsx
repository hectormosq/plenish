'use client';

/**
 * @deprecated Logic moved to MealLogger (Phase 1: 004-ui-chat-form-merge)
 * This component's chat functionality has been consolidated into MealLogger.tsx
 * which provides a unified interface for both chat and meal logging.
 * Keeping this file for reference; can be deleted after Phase 1 is verified.
 */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import styled from 'styled-components';
import { Card, CardTitle } from '@/components/ui/Card';
import { MessageSquare, Send } from 'lucide-react';
import React, { useRef, useEffect } from 'react';
import { theme } from '@/theme';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 600px;
  background-color: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.xl};
  padding: 1.5rem;
  box-shadow: ${theme.shadows.card};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${theme.colors.border};
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
    background: ${theme.colors.surfaceHighest};
    border-radius: ${theme.radii.sm};
  }
`;

const MessageBubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: 80%;
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

const InputForm = styled.form`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ChatInput = styled.input`
  flex: 1;
  background-color: ${theme.colors.surfaceHigh};
  border: 1px solid ${theme.colors.borderStrong};
  color: ${theme.colors.text};
  padding: 1rem;
  border-radius: ${theme.radii.full};
  outline: none;
  font-family: inherit;
  font-size: 1rem;

  &:focus {
    border-color: ${theme.colors.primary};
  }
  
  &::placeholder {
    color: ${theme.colors.textMuted};
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

  &:hover {
    background-color: ${theme.colors.primaryHover};
    transform: scale(1.05);
  }
  
  &:disabled {
    background-color: ${theme.colors.surfaceHighest};
    color: ${theme.colors.textMuted};
    cursor: not-allowed;
    transform: none;
  }
`;

export function AIChatBox() {
  const { messages, status, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      body: { tzOffset: new Date().getTimezoneOffset() },
    }),
  });
  const isLoading = status === 'streaming' || status === 'submitted';
  
  const [localInput, setLocalInput] = React.useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, error]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    sendMessage({ text: localInput });
    setLocalInput('');
  };

  return (
    <ChatContainer>
      <HeaderRow>
        <MessageSquare size={24} style={{ color: theme.colors.violet }} />
        <CardTitle style={{ color: theme.colors.violet }}>Plenish Agent</CardTitle>
      </HeaderRow>

      <MessageList>
        <MessageBubble $role="assistant">
          ¡Hola! Soy tu asistente de Plenish. ¿Qué comiste hoy o necesitas ayuda planificando tu semana?
        </MessageBubble>
        
        {messages.map((m: UIMessage, i: number) => {
          const content = m.parts?.filter((p) => p.type === 'text').map((p) => p.text).join('') ?? '';
          return (
            <MessageBubble key={m.id ?? i} $role={m.role as 'user' | 'assistant'}>
              {content}
            </MessageBubble>
          );
        })}
        
        {isLoading && (
          <MessageBubble $role="assistant">
            <em>Pensando...</em>
          </MessageBubble>
        )}
        
        {error && (
          <div style={{ color: theme.colors.danger, fontSize: '0.875rem', padding: '1rem', border: `1px solid ${theme.colors.danger}`, borderRadius: theme.radii.md, marginTop: '0.5rem' }}>
            <strong>Error:</strong> {error.message || 'An unknown error occurred while communicating with the AI.'}
          </div>
        )}
        
        <div ref={endOfMessagesRef} />
      </MessageList>

      <InputForm onSubmit={handleFormSubmit}>
        <ChatInput
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          placeholder="E.g., I had 3 chicken tacos for lunch..."
          disabled={isLoading}
        />
        <SendButton type="submit" disabled={isLoading || !localInput.trim()}>
          <Send size={18} />
        </SendButton>
      </InputForm>
    </ChatContainer>
  );
}
