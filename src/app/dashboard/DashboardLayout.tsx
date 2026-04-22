"use client";

import type { ReactNode } from "react";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import styled, { keyframes, css } from "styled-components";
import { Utensils, LogOut, Settings, MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionLoggerProvider } from "ai-session-logger/next";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; }
`;

// Right-side overlay slide
const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
`;
const slideOutRight = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
`;

// Left-side overlay slide
const slideInLeft = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
`;
const slideOutLeft = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
`;

// Mobile bottom sheet
const slideUp = keyframes`
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
`;
const slideDown = keyframes`
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
`;

// ─── Shell ────────────────────────────────────────────────────────────────────

const DashboardContainer = styled.div`
  height: 100vh;
  background-color: #0a0c0a;
  color: #f0f0f0;
  font-family: var(--font-geist-sans), sans-serif;
  display: flex;
  flex-direction: column;
`;

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NavBar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 12, 10, 0.95);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
  animation: ${fadeIn} 0.3s ease forwards;
`;

const NavLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #f0f0f0;
`;

const LogoAccent = styled.span`
  background: linear-gradient(135deg, #48c78e, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SettingsLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #6b7280;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
  }

  @media (max-width: 767px) {
    display: none;
  }
`;

const SignOutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: #6b7280;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #f0f0f0;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
  }
`;

// ─── Body row (calendar + optional side panel) ────────────────────────────────

const BodyRow = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
`;

const CalendarArea = styled.main`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  order: 1;
  animation: ${fadeIn} 0.4s ease 0.1s both;

  @media (max-width: 639px) {
    padding: 0.75rem 0.5rem;
  }
`;

// ─── Unified chat panel — static side panel at ≥900px, overlay below ─────────

const ChatPanel = styled.div<{ $closing: boolean; $side: 'left' | 'right' }>`
  background: #111;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* ── ≥ 900px: static side panel ── */
  @media (min-width: 900px) {
    position: relative;
    width: clamp(360px, 38vw, 560px);
    flex-shrink: 0;
    order: ${({ $side }) => $side === 'right' ? 2 : 0};
    ${({ $side }) => $side === 'right'
      ? 'border-left: 1px solid rgba(255,255,255,0.08);'
      : 'border-right: 1px solid rgba(255,255,255,0.08);'}
    animation: ${({ $closing }) =>
      $closing ? css`${fadeOut} 0.18s ease forwards` : 'none'};
  }

  /* ── 640px – 899px: fixed overlay drawer ── */
  @media (min-width: 640px) and (max-width: 899px) {
    position: fixed;
    top: 0;
    bottom: 0;
    ${({ $side }) => $side === 'right' ? 'right: 0;' : 'left: 0;'}
    width: 420px;
    z-index: 100;
    ${({ $side }) => $side === 'right'
      ? 'border-left: 1px solid rgba(255,255,255,0.08); box-shadow: -8px 0 32px rgba(0,0,0,0.5);'
      : 'border-right: 1px solid rgba(255,255,255,0.08); box-shadow: 8px 0 32px rgba(0,0,0,0.5);'}
    animation: ${({ $closing, $side }) => {
      if ($side === 'right') {
        return $closing
          ? css`${slideOutRight} 0.28s ease forwards`
          : css`${slideInRight} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`;
      }
      return $closing
        ? css`${slideOutLeft} 0.28s ease forwards`
        : css`${slideInLeft} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`;
    }};
  }

  /* ── < 640px: bottom sheet ── */
  @media (max-width: 639px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    height: 90vh;
    border-radius: 20px 20px 0 0;
    border-top: 1px solid rgba(255,255,255,0.08);
    animation: ${({ $closing }) =>
      $closing
        ? css`${slideDown} 0.3s ease forwards`
        : css`${slideUp} 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards`};
  }
`;

// ─── Panel inner chrome ───────────────────────────────────────────────────────

// Drag handle — mobile only
const SheetHandle = styled.div`
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  margin: 12px auto 0;
  flex-shrink: 0;

  @media (min-width: 640px) {
    display: none;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
`;

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #a855f7;
  font-weight: 600;
  font-size: 0.95rem;
`;

const PanelCloseButton = styled.button`
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: #888;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f0f0f0;
  }
`;

const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1rem;

  > * {
    height: 100% !important;
  }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
`;

// ─── Backdrop — only shown at overlay breakpoints (< 900px) ──────────────────

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: ${fadeIn} 0.2s ease forwards;

  @media (min-width: 900px) {
    display: none;
  }
`;

// ─── FAB ──────────────────────────────────────────────────────────────────────

const FAB = styled.button`
  position: fixed;
  z-index: 89;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #48c78e, #3b82f6);
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(72, 199, 142, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  -webkit-tap-highlight-color: transparent;

  bottom: 76px;
  right: 1.5rem;

  @media (min-width: 768px) {
    bottom: 1.5rem;
    right: 1.5rem;
  }

  &:active {
    transform: scale(0.93);
    box-shadow: 0 2px 12px rgba(72, 199, 142, 0.3);
  }
`;

// ─── Coming-soon full-width slot ──────────────────────────────────────────────

const FullWidthContent = styled.main`
  flex: 1;
  padding: 1.25rem 1.5rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

// ─── Prefill detector ────────────────────────────────────────────────────────
// Isolated into its own component so useSearchParams() can be wrapped in Suspense.


interface PrefillInfo {
  type: string;
  date: string;
}

function PrefillDetector({ onPrefill }: { onPrefill: (info: PrefillInfo) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const type = searchParams.get('prefillType');
    const date = searchParams.get('prefillDate');
    if (type) onPrefill({ type, date: date ?? '' });
  }, [searchParams, onPrefill]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  userId?: string;
  mealLoggerSlot?: ReactNode;
  calendarSlot?: ReactNode;
  comingSoonSlot?: ReactNode;
  /** Which side the chat panel opens on. Defaults to 'right'. */
  chatSide?: 'left' | 'right';
  /** Whether the chat panel starts open. Defaults to false. */
  defaultOpen?: boolean;
}

export function DashboardLayout({
  userId = "anonymous",
  calendarSlot,
  mealLoggerSlot,
  comingSoonSlot,
  chatSide = 'right',
  defaultOpen = false,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [closing, setClosing] = useState(false);
  const [prefillInfo, setPrefillInfo] = useState<PrefillInfo | null>(null);
  // Prevents router.replace (called in handleClose) from re-triggering PrefillDetector
  const isClosingRef = useRef(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleOpen() {
    setClosing(false);
    setOpen(true);
  }

  function handleClose() {
    isClosingRef.current = true;
    setPrefillInfo(null);
    router.replace('/dashboard', { scroll: false });
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      isClosingRef.current = false;
    }, 300);
  }

  const handleOpenFromPrefill = useCallback((info: PrefillInfo) => {
    if (isClosingRef.current) return;
    setPrefillInfo(info);
    setClosing(false);
    setOpen(true);
  }, []);

  return (
    <SessionLoggerProvider userId={userId} app="plenish">
      <Suspense>
        <PrefillDetector onPrefill={handleOpenFromPrefill} />
      </Suspense>

      <DashboardContainer>
        {/* ── Top Nav ─────────────────────────────────────────────────── */}
        <NavBar>
          <NavLogo>
            <Utensils size={20} color="#48c78e" />
            <LogoAccent>Plenish</LogoAccent>
          </NavLogo>
          <NavActions>
            <SettingsLink href="/settings">
              <Settings size={14} />
              Settings
            </SettingsLink>
            <SignOutButton id="sign-out-btn" onClick={handleSignOut}>
              <LogOut size={14} />
              Sign out
            </SignOutButton>
          </NavActions>
        </NavBar>

        {/* ── Page body ───────────────────────────────────────────────── */}
        {comingSoonSlot ? (
          <FullWidthContent>{comingSoonSlot}</FullWidthContent>
        ) : (
          <BodyRow>
            <CalendarArea>{calendarSlot}</CalendarArea>

            {mealLoggerSlot && open && (
              <>
                {/* Backdrop: hidden at ≥900px via CSS */}
                <Backdrop onClick={handleClose} />

                <ChatPanel $closing={closing} $side={chatSide}>
                  {/* Drag handle — mobile only via CSS */}
                  <SheetHandle />

                  <PanelHeader>
                    <PanelTitle>
                      <MessageSquare size={16} />
                      Plenish Agent
                    </PanelTitle>
                    <PanelCloseButton onClick={handleClose} aria-label="Close chat">
                      <X size={15} />
                    </PanelCloseButton>
                  </PanelHeader>

                  <PanelBody>{mealLoggerSlot}</PanelBody>
                </ChatPanel>
              </>
            )}
          </BodyRow>
        )}

        {/* ── FAB — shown when panel is closed ────────────────────────── */}
        {mealLoggerSlot && !open && (
          <FAB aria-label="Open chat" onClick={handleOpen}>
            <MessageSquare size={24} />
          </FAB>
        )}
      </DashboardContainer>
    </SessionLoggerProvider>
  );
}
