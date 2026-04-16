"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import styled, { keyframes, css } from "styled-components";
import { Utensils, LogOut, Settings, MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SessionLoggerProvider } from "ai-session-logger/next";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
`;

const slideOutRight = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
`;

const slideDown = keyframes`
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
`;

// ─── Nav ──────────────────────────────────────────────────────────────────────

const DashboardContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0c0a;
  color: #f0f0f0;
  font-family: var(--font-geist-sans), sans-serif;
  display: flex;
  flex-direction: column;
`;

const NavBar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 12, 10, 0.85);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
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

// ─── Page content — full-width calendar ───────────────────────────────────────

const PageContent = styled.main`
  flex: 1;
  padding: 1.25rem 1.5rem;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  animation: ${fadeIn} 0.4s ease 0.1s both;

  @media (max-width: 639px) {
    padding: 0.75rem 0.5rem;
  }
`;

// ─── Full-width slot for non-dashboard pages ──────────────────────────────────

const FullWidthContent = styled.main`
  flex: 1;
  padding: 1.25rem 1.5rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

// ─── Chat Drawer — desktop ────────────────────────────────────────────────────

const DrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: ${fadeIn} 0.2s ease forwards;

  /* Desktop only */
  @media (max-width: 767px) {
    display: none;
  }
`;

const Drawer = styled.div<{ $closing: boolean; $side: 'left' | 'right' }>`
  position: fixed;
  top: 0;
  bottom: 0;
  ${({ $side }) => $side === 'right' ? 'right: 0;' : 'left: 0;'}
  width: 420px;
  z-index: 100;
  background: #111;
  border-${({ $side }) => $side === 'right' ? 'left' : 'right'}: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  box-shadow: ${({ $side }) =>
    $side === 'right'
      ? '-8px 0 32px rgba(0,0,0,0.5)'
      : '8px 0 32px rgba(0,0,0,0.5)'};

  animation: ${({ $closing, $side }) =>
    $closing
      ? css`${slideOutRight} 0.28s ease forwards`
      : css`${slideInRight} 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards`};

  /* Desktop only */
  @media (max-width: 767px) {
    display: none;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
`;

const DrawerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #a855f7;
  font-weight: 600;
  font-size: 0.95rem;
`;

const DrawerCloseButton = styled.button`
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

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1rem;

  > * {
    height: 100% !important;
  }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
`;

// ─── Bottom sheet — mobile ────────────────────────────────────────────────────

const SheetBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.2s ease forwards;

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

const SheetCloseButton = styled.button`
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

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f0f0f0;
  }
`;

const SheetBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1rem;

  > * {
    height: 100% !important;
  }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
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
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  -webkit-tap-highlight-color: transparent;

  /* Mobile: above bottom nav */
  bottom: 76px;
  right: 1.5rem;

  /* Desktop: bottom-right corner */
  @media (min-width: 768px) {
    bottom: 1.5rem;
    right: 1.5rem;
  }

  &:active {
    transform: scale(0.93);
    box-shadow: 0 2px 12px rgba(72, 199, 142, 0.3);
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  userId?: string;
  mealLoggerSlot?: ReactNode;
  calendarSlot?: ReactNode;
  comingSoonSlot?: ReactNode;
  /** Which side the chat drawer opens on desktop. Defaults to 'right'. */
  chatSide?: 'left' | 'right';
}

export function DashboardLayout({
  userId = "anonymous",
  calendarSlot,
  mealLoggerSlot,
  comingSoonSlot,
  chatSide = 'right',
}: DashboardLayoutProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

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
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
  }

  return (
    <SessionLoggerProvider userId={userId} app="plenish">
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
          <PageContent>{calendarSlot}</PageContent>
        )}

        {/* ── Desktop Chat Drawer ──────────────────────────────────────── */}
        {mealLoggerSlot && open && (
          <>
            <DrawerBackdrop onClick={handleClose} />
            <Drawer $closing={closing} $side={chatSide}>
              <DrawerHeader>
                <DrawerTitle>
                  <MessageSquare size={16} />
                  Plenish Agent
                </DrawerTitle>
                <DrawerCloseButton onClick={handleClose} aria-label="Close chat">
                  <X size={15} />
                </DrawerCloseButton>
              </DrawerHeader>
              <DrawerBody>{mealLoggerSlot}</DrawerBody>
            </Drawer>
          </>
        )}

        {/* ── Mobile Bottom Sheet ──────────────────────────────────────── */}
        {mealLoggerSlot && open && (
          <>
            <SheetBackdrop onClick={handleClose} />
            <Sheet $closing={closing}>
              <SheetHandle />
              <SheetHeader>
                <SheetCloseButton onClick={handleClose} aria-label="Close chat">
                  <X size={16} />
                </SheetCloseButton>
              </SheetHeader>
              <SheetBody>{mealLoggerSlot}</SheetBody>
            </Sheet>
          </>
        )}

        {/* ── FAB — all screen sizes ───────────────────────────────────── */}
        {mealLoggerSlot && !open && (
          <FAB aria-label="Open chat" onClick={handleOpen}>
            <MessageSquare size={24} />
          </FAB>
        )}
      </DashboardContainer>
    </SessionLoggerProvider>
  );
}
