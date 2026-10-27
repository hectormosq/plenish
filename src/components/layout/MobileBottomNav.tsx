'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styled from 'styled-components';
import { Home, ClipboardList, UtensilsCrossed, Settings } from 'lucide-react';
import { theme, alpha } from '@/theme';

// ─── Styled Components ────────────────────────────────────────────────────────

const Nav = styled.nav`
  display: flex;
  align-items: stretch;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 60px;
  background: ${alpha(theme.colors.bg, 0.97)};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid ${theme.colors.border};
  /* account for iOS safe area */
  padding-bottom: env(safe-area-inset-bottom);

  /* hidden on desktop */
  @media (min-width: 768px) {
    display: none;
  }
`;

const TabLink = styled(Link)<{ $active: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-decoration: none;
  color: ${({ $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  font-size: 0.65rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  letter-spacing: 0.03em;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;

  svg {
    transition: color 0.2s;
  }

  &:active {
    opacity: 0.7;
  }
`;

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { href: '/dashboard', label: 'Home', Icon: Home },
  { href: '/history', label: 'History', Icon: ClipboardList },
  { href: '/recipes', label: 'Recipes', Icon: UtensilsCrossed },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <Nav aria-label="Main navigation">
      {TABS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <TabLink key={href} href={href} $active={isActive} aria-current={isActive ? 'page' : undefined}>
            <Icon size={20} />
            {label}
          </TabLink>
        );
      })}
    </Nav>
  );
}
