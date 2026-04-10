# Research: Codebase Patterns & Reusable Code

**Phase**: Phase 0 Research | **Date**: 2026-04-10

## Overview

This document captures key patterns, existing implementations, and reusable code found in the Plenish codebase that inform the MealLogger implementation.

---

## 1. Chat Component Pattern (AIChatBox.tsx)

**Location**: `/src/components/specific/AIChatBox.tsx` (~200 lines)

**Key Findings**:

### Hooks & State
```typescript
const { messages, status, error, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    body: { tzOffset: new Date().getTimezoneOffset() },
  }),
});
const isLoading = status === 'streaming' || status === 'submitted';
const [localInput, setLocalInput] = useState('');
```

- Uses `@ai-sdk/react` `useChat()` hook
- Passes `tzOffset` via `DefaultChatTransport.body`
- Tracks `status` for loading states
- Local input state with `useState`

### Styled Components (Reuse as-is)
```typescript
const ChatContainer = styled.div`
  height: 600px; // Fixed height
  background-color: #1a1a1a;
  border-radius: 16px;
  padding: 1.5rem;
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  &::-webkit-scrollbar { width: 6px; }
`;

const MessageBubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: 80%;
  padding: 1rem;
  border-radius: 12px;
  ${(props) => props.$role === 'user' ? /* blue styling */ : /* gray styling */}
`;

const InputForm = styled.form`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ChatInput = styled.input`
  flex: 1;
  background-color: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 1rem;
  border-radius: 9999px;
  &:focus { border-color: #3b82f6; }
`;

const SendButton = styled.button`
  background-color: #3b82f6;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background-color: #2563eb; transform: scale(1.05); }
  &:disabled { background-color: #444; cursor: not-allowed; }
`;
```

**Reusable**: All of these can be directly copied into `MealLogger.tsx`.

### Message Rendering
```typescript
{messages.map((m: UIMessage, i: number) => {
  const content = m.parts?.filter((p) => p.type === 'text')
    .map((p) => p.text).join('') ?? '';
  return (
    <MessageBubble key={m.id ?? i} $role={m.role as 'user' | 'assistant'}>
      {content}
    </MessageBubble>
  );
})}
```

**Pattern**: Filter `parts` for text, render with role-based styling.

### Auto-Scroll to Bottom
```typescript
const endOfMessagesRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, error]);

// In render:
<div ref={endOfMessagesRef} />
```

**Reusable**: Copy this pattern for MealLogger message list.

---

## 2. Form Component Pattern (LogMealForm.tsx)

**Location**: `/src/components/specific/LogMealForm.tsx` (~270 lines)

**Key Findings**:

### Form State Management
```typescript
const [logText, setLogText] = useState('');
const [mealType, setMealType] = useState<MealType>('lunch');
const [errorMsg, setErrorMsg] = useState('');
const [isShared, setIsShared] = useState(false);
const [selectedCoEaters, setSelectedCoEaters] = useState<Set<string>>(new Set());
```

**Pattern**: Multiple state hooks for form fields. `MealLogger` will use similar structure.

### Server Action Integration
```typescript
const [isPending, startTransition] = useTransition();

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!logText.trim()) return;
  setErrorMsg('');

  startTransition(async () => {
    try {
      await logMeal(logText, mealType, isShared && householdId ? {
        isShared: true,
        householdId,
        coEaterIds: Array.from(selectedCoEaters),
      } : undefined);
      setLogText('');
      setIsShared(false);
      setSelectedCoEaters(new Set());
      router.refresh();
    } catch (e: unknown) {
      setErrorMsg('Failed to log meal. Please try again.');
    }
  });
};
```

**Reusable Pattern**:
- Use `useTransition` to track async action state
- Call server action (`logMeal`) inside `startTransition`
- Handle errors with `setErrorMsg`
- Clear form state after success
- Call `router.refresh()` to revalidate

### Styled Components (Reuse)
```typescript
const Label = styled.label`
  font-size: 0.875rem;
  color: #a3a3a3;
  font-weight: 500;
`;

const TextInput = styled.input`
  background-color: #222;
  border: 1px solid #333;
  color: #fff;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  &:focus { border-color: #10b981; }
`;

const SelectInput = styled.select`
  background-color: #222;
  border: 1px solid #333;
  color: #fff;
  padding: 0.875rem 1rem;
  border-radius: 8px;
`;

const SubmitButton = styled.button<{ $loading?: boolean }>`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.875rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;
```

**Note**: For MealLogger, the SelectInput dropdown is replaced by chips, but these patterns are reusable.

### Share Toggle Pattern
```typescript
const ShareToggle = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? 'rgba(59,130,246,0.15)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#3b82f6' : '#333')};
  color: ${({ $active }) => ($active ? '#93c5fd' : '#6b7280')};
  border-radius: 8px;
  padding: 0.45rem 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
`;

// Usage:
<ShareToggle
  type="button"
  $active={isShared}
  onClick={() => { setIsShared((v) => !v); setSelectedCoEaters(new Set()); }}
>
  <Users size={13} />
  {isShared ? 'Sharing with household' : 'Share with household'}
</ShareToggle>
```

**Reusable**: This pattern can be extended for the 3-state share button in MealLogger.

### Checkbox List for Co-Eaters
```typescript
const MemberCheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #d1d5db;
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  background: #1a1a1a;

  input[type='checkbox'] { accent-color: #3b82f6; }
`;

{householdMembers.map((m) => (
  <MemberCheckRow key={m.user_id}>
    <input
      type="checkbox"
      checked={selectedCoEaters.has(m.user_id)}
      onChange={() => toggleCoEater(m.user_id)}
      disabled={isPending}
    />
    {m.display_name}
  </MemberCheckRow>
))}
```

**Note**: Phase 1 placeholder for share button; Phase 3 will replace hidden checkboxes with popover member picker.

---

## 3. Server Actions Pattern (actions/meals.ts)

**Location**: `/src/actions/meals.ts`

**Key Findings**:

### logMeal Action Signature
```typescript
export async function logMeal(
  logText: string,
  mealType: MealType,
  options?: {
    isShared?: boolean;
    householdId?: string;
    coEaterIds?: string[];
  }
): Promise<void>
```

**Reusable**: MealLogger calls this directly via `startTransition`.

### MealLog Type
```typescript
export type MealLog = {
  id: string;
  log_text: string;
  meal_type: string;
  eaten_at: string;
  user_id: string;
  is_shared: boolean;
};
```

**Usage**: For future type-safe meal handling.

---

## 4. Card & UI Component Patterns

**Location**: `/src/components/ui/`

### Card Component (Reuse)
```typescript
export const Card = styled.div`
  background: #1a1a1a;
  border: 1px solid #333;
  padding: 1.5rem;
  border-radius: 12px;
  margin-top: 1rem;
`;

export const CardTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  color: #f0f0f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;
```

**MealLogger Usage**: Wrap component in `<Card>` or use similar container styling.

### Icon Pattern (Lucide React)
All icons use:
```typescript
import { MessageSquare, Send, PlusCircle, Users, Clock, ... } from 'lucide-react';

// Usage:
<MessageSquare size={24} color="#a855f7" />
<Send size={18} />
```

**Colors Used**:
- Chat: `#a855f7` (purple)
- Meals: `#10b981` (green)
- Share: `#3b82f6` (blue)
- Household: `#3b82f6` (blue)

---

## 5. Meal Type Colors

**Location**: Scattered across components (breakfast/lunch/dinner/snack)

**Colors**:
```typescript
const mealTypeColors = {
  breakfast: '#fbbf24', // amber/yellow
  lunch: '#34d399',     // green
  dinner: '#818cf8',    // indigo/blue
  snack: '#a78bfa',     // purple
};
```

**For Meal Type Chips**: Use these colors for chip labels or icons.

---

## 6. Responsive Layout Pattern

**Location**: `/src/app/dashboard/DashboardLayout.tsx`

**Key Finding**:
```typescript
const PageContent = styled.main`
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr;

  @media (min-width: 1024px) {
    grid-template-columns: 60% 1fr; // 60/40 split
  }
`;
```

**Implication**: MealLogger in left column (60%) on desktop, full-width on mobile. No changes needed for Phase 1.

---

## 7. Sponsor/Household Passing Pattern

**Location**: `/src/components/specific/LogMealFormWrapper.tsx`

```typescript
export async function LogMealFormWrapper() {
  const [household, householdMembers] = await Promise.all([
    getHousehold(),
    getHouseholdMembers(),
  ]);

  return (
    <Suspense fallback={<SkeletonCard />}>
      <LogMealForm
        householdMembers={householdMembers}
        householdId={household?.id}
      />
    </Suspense>
  );
}
```

**For MealLogger**: Keep this wrapper pattern. Pass `householdMembers` prop to `MealLogger`.

---

## 8. Dashboard Layout Slot Pattern

**Location**: `/src/app/dashboard/DashboardLayout.tsx`

```typescript
export function DashboardLayout({
  recentMealsSlot,
  recommendationSlot,
  householdSlot,
  logMealFormSlot, // ← rename to mealLoggerSlot
  sharedMealLogSlot,
}: {
  recentMealsSlot: ReactNode;
  recommendationSlot: ReactNode;
  householdSlot?: ReactNode;
  logMealFormSlot?: ReactNode; // → mealLoggerSlot
  sharedMealLogSlot?: ReactNode;
}) {
  return (
    <PageContent>
      <LeftColumn>
        <AIChatBox /> {/* ← will be removed/deprecated */}
        {logMealFormSlot}
      </LeftColumn>
      <RightColumn>
        {recentMealsSlot}
        {householdSlot}
        {sharedMealLogSlot}
        {recommendationSlot}
      </RightColumn>
    </PageContent>
  );
}
```

**Change for Phase 1**:
- Remove `<AIChatBox />` (MealLogger replaces it)
- Rename `logMealFormSlot` → `mealLoggerSlot`
- Pass MealLogger to slot instead

---

## Summary of Reusable Code

### Direct Copy (No Changes)
- ✅ `ChatContainer`, `MessageList`, `MessageBubble`, `InputForm`, `ChatInput`, `SendButton` (AIChatBox styling)
- ✅ `Label`, `TextInput`, `SubmitButton` (LogMealForm styling)
- ✅ `ShareToggle` pattern (for share button base)
- ✅ `useChat()` hook configuration
- ✅ `useTransition` + `router.refresh()` pattern
- ✅ Message rendering logic with parts filtering
- ✅ Auto-scroll to bottom (useRef + useEffect)
- ✅ logMeal server action call

### Adapt/Extend
- ❌ SelectInput dropdown → Replace with Chip component (new)
- ⚠️ isShared toggle → Extend to 3-state button (Phase 1 visual, Phase 3 logic)
- ⚠️ Hidden checkbox list → Defer to popover in Phase 3

### New Components
- ✨ `MealTypeChip` — Toggleable chip button for meal type selection
- ✨ `ChipRow` — Flex container for chips
- ✨ Extended `ShareButton` — 3-state visual (placeholder for Phase 3 interactivity)

---

## Decision: Consolidation Strategy

**Why consolidate into one component?**
- Reduces component nesting (wrapper + component + UI)
- Unifies state management (chat + form in one component)
- Simplifies prop passing (no more dual interface)
- Clearer for user (one UI, one input method)

**Why keep patterns separate?**
- `useChat()` = chat state
- `useTransition` + meal logging = form state
- No conflict; patterns are orthogonal

**Implementation**: Single `MealLogger.tsx` component with:
1. Chat message list (from AIChatBox)
2. Meal type chips (new)
3. Input field (merged from both)
4. Share button (enhanced)
5. Send handler that determines action (chat or meal)

---

## Next Steps

- Research.md ✅ (this file)
- Create `MealLogger.tsx` (plan.md specifies ~300-400 lines)
- Modify wrapper + dashboard layout (plan.md)
- Test in browser (plan.md testing strategy)
- Commit with branch `004-ui-chat-form-merge`
