'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { X } from 'lucide-react';

// ─── Animations ───────────────────────────────────────────────────────────────

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
`;

const slideDown = keyframes`
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

// ─── Styled Components ────────────────────────────────────────────────────────

const Backdrop = styled.div<{ $visible: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.2s ease forwards;

  /* Only shown on mobile */
  @media (min-width: 768px) {
    display: none;
  }
`;

const Sheet = styled.div<{ $closing: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  height: 90vh;
  background: #111;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  animation: ${({ $closing }) =>
    $closing
      ? css`${slideDown} 0.3s ease forwards`
      : css`${slideUp} 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards`};

  /* Only shown on mobile */
  @media (min-width: 768px) {
    display: none;
  }
`;

const SheetHandle = styled.div`
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  margin: 12px auto 0;
  flex-shrink: 0;
`;

const SheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.75rem 1rem 0;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.07);
  border: none;
  color: #aaa;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f0f0f0;
  }
`;

const SheetBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1rem;

  /* Remove the ChatContainer's fixed height so it fills the sheet */
  > * {
    height: 100% !important;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface MealLoggerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MealLoggerBottomSheet({
  isOpen,
  onClose,
  children,
}: MealLoggerBottomSheetProps) {
  // Lock body scroll while sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Backdrop $visible={isOpen} onClick={onClose} />
      <Sheet $closing={false}>
        <SheetHandle />
        <SheetHeader>
          <CloseButton onClick={onClose} aria-label="Close meal logger">
            <X size={16} />
          </CloseButton>
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
      </Sheet>
    </>
  );
}
