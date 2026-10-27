/**
 * Design tokens. CSS custom properties in `globals.css` are the source of
 * truth; this object wraps them so styled-components get typed autocomplete.
 * Palette and scales come from the Stitch "Nutritional Co-Pilot" design system.
 */

const v = (name: string) => `var(--${name})`;

const colors = {
  // Surfaces, from the page canvas up to modals
  bg:              v('color-bg'),
  surface:         v('color-surface'),
  surfaceContainer: v('color-surface-container'),
  surfaceHigh:     v('color-surface-high'),
  surfaceHighest:  v('color-surface-highest'),
  overlay:         v('color-overlay'),
  overlayStrong:   v('color-overlay-strong'),

  border:          v('color-border'),
  borderStrong:    v('color-border-strong'),

  text:            v('color-text'),
  textSecondary:   v('color-text-secondary'),
  textMuted:       v('color-text-muted'),
  textFaint:       v('color-text-faint'),

  // Accents
  primary:         v('color-primary'),
  primaryHover:    v('color-primary-hover'),
  primaryBright:   v('color-primary-bright'),
  onPrimary:       v('color-on-primary'),
  secondary:       v('color-secondary'),
  secondaryBright: v('color-secondary-bright'),
  tertiary:        v('color-tertiary'),
  danger:          v('color-danger'),
  dangerBright:    v('color-danger-bright'),
  info:            v('color-info'),
  infoBright:      v('color-info-bright'),
  violet:          v('color-violet'),
  indigo:          v('color-indigo'),
  shadow:          v('color-shadow'),
} as const;

export const theme = {
  colors,
  meal: {
    breakfast: colors.secondary,
    snack:     colors.violet,
    lunch:     colors.primary,
    dinner:    colors.indigo,
  },
  radii: {
    sm:   v('radius-sm'),
    md:   v('radius-md'),
    lg:   v('radius-lg'),
    xl:   v('radius-xl'),
    full: v('radius-full'),
  },
  shadows: {
    card:    v('shadow-card'),
    popover: v('shadow-popover'),
    modal:   v('shadow-modal'),
    focus:   v('shadow-focus'),
  },
  fonts: {
    sans: v('font-sans'),
  },
  fontSizes: {
    labelSm:    '0.6875rem',
    bodySm:     '0.75rem',
    bodyMd:     '0.875rem',
    bodyLg:     '1rem',
    headlineSm: '1.125rem',
    headlineMd: '1.375rem',
    headlineLg: '1.75rem',
    displayMd:  '2.25rem',
  },
  space: {
    xs:  '0.25rem',
    sm:  '0.5rem',
    md:  '1rem',
    lg:  '1.5rem',
    xl:  '2rem',
    xxl: '3rem',
  },
} as const;

export type AppTheme = typeof theme;

/** A token colour at the given opacity (0–1), e.g. `alpha(theme.colors.primary, 0.12)`. */
export function alpha(color: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(amount * 1000) / 10}%, transparent)`;
}
