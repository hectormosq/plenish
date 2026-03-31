---
name: styled-components-ui
description: Guidelines for building and structuring UI components with styled-components.
---

# Styled Components UI Structure

## Goal
To maintain a scalable, consistent, and beautiful premium UI using `styled-components`, without relying on Tailwind CSS or external component libraries. 

## File Structure
All reusable UI components should live in the `src/components` directory. 
Structure them by component type or feature:

```
src/
└── components/
    ├── ui/               # Generic, reusable building blocks (Buttons, Inputs, Cards)
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   └── Input.tsx
    ├── layout/           # Layout specific components (Header, Sidebar, Footer)
    │   ├── Header.tsx
    │   └── Navigation.tsx
    └── specific/         # Domain-specific components
        └── MealCard.tsx
```

## Component Guidelines

1. **Colocation:** Keep styles and business logic colocated in the same file for generic UI components, unless the file becomes too large (in which case, split styles into `ComponentName.styles.ts`).
2. **Exporting:** Always export the raw styled component if it's simple, or wrap it in a React component if it requires props manipulation or internal state.
3. **Props Typing:** Use TypeScript to strictly type props, extending standard HTML attributes when appropriate (e.g., `extends React.ButtonHTMLAttributes<HTMLButtonElement>`).
4. **Theme Consistency:** Use CSS variables or a central `styled-components` ThemeProvider for colors, spacing, and typography to maintain a premium dark-mode aesthetic. 
   - Never use hardcoded colors representing red, blue, green blindly. Use vibrant, polished palettes.
   - Use dynamic hover states and transitions for interactive elements.
5. **Client Components:** Remember that `styled-components` require the `'use client'` directive at the top of the file in Next.js App Router.

## Example: Button Component
```tsx
'use client';

import styled from 'styled-components';

export const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  background-color: ${props => props.$variant === 'secondary' ? 'transparent' : '#3b82f6'};
  color: ${props => props.$variant === 'secondary' ? '#3b82f6' : '#ffffff'};
  border: ${props => props.$variant === 'secondary' ? '1px solid #3b82f6' : 'none'};
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
`;
```
