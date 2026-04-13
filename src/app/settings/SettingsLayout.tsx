'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styled, { keyframes } from 'styled-components';
import { Utensils, LogOut, ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
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

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
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

const BackLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #6b7280;
  font-size: 0.875rem;
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: #f0f0f0;
    border-color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.04);
  }
`;

const SignOutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: #6b7280;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #f0f0f0;
    border-color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.04);
  }
`;

const PageContent = styled.main`
  flex: 1;
  padding: 1.5rem;
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

const PageHeading = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #f0f0f0;
  letter-spacing: -0.02em;
`;

export function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Container>
      <NavBar>
        <NavLeft>
          <NavLogo>
            <Utensils size={20} color="#48c78e" />
            <LogoAccent>Plenish</LogoAccent>
          </NavLogo>
          <BackLink href="/dashboard">
            <ChevronLeft size={14} />
            Dashboard
          </BackLink>
        </NavLeft>
        <SignOutButton onClick={handleSignOut}>
          <LogOut size={14} />
          Sign out
        </SignOutButton>
      </NavBar>

      <PageContent>
        <PageHeading>Settings</PageHeading>
        {children}
      </PageContent>
    </Container>
  );
}
