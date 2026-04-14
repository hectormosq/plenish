'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import styled, { keyframes } from 'styled-components';
import { Utensils, LogOut, Settings, PlusCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MealLoggerBottomSheet } from '@/components/specific/MealLoggerBottomSheet';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
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

  /* Settings link in top nav not needed on mobile — bottom nav handles it */
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

// ─── Dashboard 2-column grid ──────────────────────────────────────────────────

const PageContent = styled.main`
  flex: 1;
  padding: 1.25rem 1.5rem;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
  animation: ${fadeIn} 0.4s ease 0.1s both;

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  }
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

/** On mobile, the inline MealLogger is hidden — the FAB + sheet take over */
const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 767px) {
    display: none;
  }
`;

// ─── Full-width slot for Coming Soon pages (History, Recipes) ─────────────────

const FullWidthContent = styled.main`
  flex: 1;
  padding: 1.25rem 1.5rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

// ─── FAB — mobile only ────────────────────────────────────────────────────────

const FAB = styled.button`
  position: fixed;
  bottom: 76px; /* sits above the 60px bottom nav */
  right: 1.5rem;
  z-index: 90;
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

  &:active {
    transform: scale(0.93);
    box-shadow: 0 2px 12px rgba(72, 199, 142, 0.3);
  }

  /* Desktop: hide FAB — inline MealLogger is shown instead */
  @media (min-width: 768px) {
    display: none;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  /** Left column: inline MealLogger (hidden on mobile, replaced by FAB+sheet) */
  mealLoggerSlot?: ReactNode;
  /** Right column: calendar grid */
  calendarSlot?: ReactNode;
  /** Full-width slot for Coming Soon pages (History, Recipes) — replaces grid layout */
  comingSoonSlot?: ReactNode;
}

export function DashboardLayout({
  calendarSlot,
  mealLoggerSlot,
  comingSoonSlot,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
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
        /* Coming Soon pages: full-width, no grid */
        <FullWidthContent>{comingSoonSlot}</FullWidthContent>
      ) : (
        /* Dashboard: 2-column grid */
        <PageContent>
          {/* Left Column — inline chat (desktop) */}
          <LeftColumn>{mealLoggerSlot}</LeftColumn>

          {/* Right Column — calendar */}
          <RightColumn>{calendarSlot}</RightColumn>
        </PageContent>
      )}

      {/* ── Mobile FAB + Bottom Sheet ────────────────────────────────── */}
      {mealLoggerSlot && (
        <>
          <FAB
            aria-label="Log a meal"
            onClick={() => setSheetOpen(true)}
          >
            <PlusCircle size={26} />
          </FAB>

          <MealLoggerBottomSheet
            isOpen={sheetOpen}
            onClose={() => setSheetOpen(false)}
          >
            {mealLoggerSlot}
          </MealLoggerBottomSheet>
        </>
      )}
    </DashboardContainer>
  );
}
