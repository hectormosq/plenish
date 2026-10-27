'use client';

import styled, { keyframes } from 'styled-components';
import { Utensils } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { theme, alpha } from '@/theme';

// --- Animations ---
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 ${alpha(theme.colors.primary, 0.4)}; }
  50%       { box-shadow: 0 0 0 12px ${alpha(theme.colors.primary, 0)}; }
`;

// --- Styled Components ---
const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 60% 10%, ${alpha(theme.colors.primary, 0.15)} 0%, ${theme.colors.bg} 60%),
              linear-gradient(180deg, ${theme.colors.surface} 0%, ${theme.colors.bg} 100%);
  padding: 2rem;
  font-family: var(--font-sans);
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 3rem 2.5rem;
  background: ${theme.colors.overlay};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.xl};
  backdrop-filter: blur(12px);
  max-width: 420px;
  width: 100%;
  animation: ${fadeUp} 0.5s ease forwards;
`;

const LogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const AppName = styled.h1`
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: ${theme.colors.primary};
  margin: 0;
`;

const Tagline = styled.p`
  color: ${theme.colors.textMuted};
  font-size: 0.95rem;
  text-align: center;
  line-height: 1.6;
  margin: 0;
`;

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: ${theme.colors.overlayStrong};
`;

const GoogleButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.9rem 1.5rem;
  background: ${theme.colors.text};
  color: ${theme.colors.onPrimary};
  border: none;
  border-radius: ${theme.radii.lg};
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  animation: ${pulse} 2.5s ease-in-out 1s infinite;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px ${alpha(theme.colors.text, 0.12)};
  }

  &:active {
    transform: translateY(0);
  }
`;

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function LoginPage() {
  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <PageWrapper>
      <Card>
        <LogoRow>
          <Utensils size={32} style={{ color: theme.colors.primary }} />
          <AppName>Plenish</AppName>
        </LogoRow>

        <Tagline>
          Your AI-powered meal planning assistant.<br />
          Log meals, get recipes, plan your week.
        </Tagline>

        <Divider />

        <GoogleButton id="google-signin-btn" onClick={handleGoogleSignIn}>
          <GoogleIcon />
          Continue with Google
        </GoogleButton>
      </Card>
    </PageWrapper>
  );
}
