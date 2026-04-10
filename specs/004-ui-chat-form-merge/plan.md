# Implementation Plan: Merge Chat + Log Form UI

**Branch**: `004-ui-chat-form-merge` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification + master plan from `/plans/composed-scribbling-dragonfly.md`

## Summary

Merge the standalone `AIChatBox` and `LogMealForm` components into a single unified `MealLogger` component. Replace the meal type dropdown with optional meal type chips. Implement the 3-state share button visually. This foundation unifies the user's meal-logging into a conversational interface and enables all subsequent UI phases.

**Scope**: UI consolidation only — no database changes, no new server actions, no behavior changes to existing features.

---

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)  
**Primary Dependencies**: Vercel AI SDK (`ai`, `@ai-sdk/react`), styled-components, Lucide React icons  
**Storage**: PostgreSQL via Supabase — no schema changes required  
**Testing**: `npm run build` (tsc + Next.js build); manual UI testing in browser  
**Target Platform**: Vercel (Node.js runtime, client-side React)  
**Project Type**: Web application (Next.js App Router, full-stack)  
**Performance Goals**: Same rendering as current (`AIChatBox` + `LogMealForm` are now one component = slightly faster)  
**Scale/Scope**: Single-user sessions; no concurrency concerns  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| No new server actions required | ✅ | Reuses existing `logMeal`, `useChat`, `useTransition` patterns |
| Styling via styled-components only | ✅ | No Tailwind; leverages existing `MemberCheckRow`, `Card`, button styles |
| TypeScript strict / zero build errors | ✅ | New component will be fully typed |
| No hardcoded user identity | ✅ | Household members passed as props from `LogMealFormWrapper` |
| No breaking changes to existing features | ✅ | Only UI consolidation; all server actions unchanged |
| Reusable patterns applied | ✅ | Combines existing `useChat()` + `useTransition` + styled-components patterns |
| Mobile responsive | ✅ | Component fits in 600px height; stacks cleanly on mobile |

**Verdict**: No violations. Proceeding.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-ui-chat-form-merge/
├── spec.md              ← Feature specification (user scenarios, requirements, success criteria)
├── plan.md              ← this file (technical plan, file changes, patterns)
├── research.md          ← Phase 0 output (codebase patterns, reusable code)
├── tasks.md             ← Phase 2 output (granular tasks/checklist)
└── checklists/
    └── requirements.md  ← Verification checklist
```

### Source Code (files affected by this feature)

```text
src/
├── components/specific/
│   ├── MealLogger.tsx                    ← CREATE NEW (merged chat + form)
│   ├── LogMealFormWrapper.tsx            ← MODIFY (pass `householdMembers` to MealLogger)
│   ├── LogMealForm.tsx                   ← DEPRECATE (replaced by MealLogger)
│   └── AIChatBox.tsx                     ← KEEP (logic extracted into MealLogger, can deprecate)
├── app/dashboard/
│   ├── DashboardLayout.tsx               ← MODIFY (rename `logMealFormSlot` → `mealLoggerSlot`)
│   └── page.tsx                          ← MODIFY (pass slot to MealLogger)
└── lib/
    └── (no changes to lib)
```

**Structure Decision**: Single component consolidation. No new directories needed. Leverage existing patterns from `AIChatBox` + `LogMealForm`.

---

## Implementation Strategy

### Phase 0: Research (See `research.md`)

- [ ] Identify all styled-components used in `AIChatBox` and `LogMealForm`
- [ ] Extract `useChat()` hook configuration from `AIChatBox`
- [ ] Extract `useTransition` meal logging pattern from `LogMealForm`
- [ ] Confirm household member passing from `LogMealFormWrapper`
- [ ] Identify color scheme for meal type chips

### Phase 1: Component Design

**MealLogger.tsx** (new, ~300-400 lines):

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { logMeal, MealType } from '@/actions/meals';
import type { HouseholdMemberSimple } from '@/actions/households';
import { Send } from 'lucide-react';

// Styled components (combine UI from both previous components)
const MealLoggerContainer = styled.div`...`; // From ChatContainer
const HeaderRow = styled.div`...`; // From HeaderRow
const MessageList = styled.div`...`; // From MessageList
const InputForm = styled.form`...`; // From InputForm
const ChipRow = styled.div`...`; // NEW: meal type chips

// NEW: Chip component for meal type selection
const MealTypeChip = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? '#3b82f6' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#3b82f6' : '#333')};
  color: ${({ $active }) => ($active ? '#fff' : '#999')};
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: #3b82f6; }
`;

// NEW: 3-state share button (visual only)
const ShareButton = styled.button<{ $state: 'just-me' | 'all' | 'partial' }>`
  // Implementation in Phase 3, stub here
  background: ${({ $state }) => ($state === 'just-me' ? 'transparent' : '#3b82f6')};
  border: 1px solid ${({ $state }) => ($state === 'just-me' ? '#333' : '#3b82f6')};
  color: ${({ $state }) => ($state === 'just-me' ? '#999' : '#fff')};
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
`;

interface MealLoggerProps {
  householdMembers?: HouseholdMemberSimple[];
}

export function MealLogger({ householdMembers = [] }: MealLoggerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Chat state (from AIChatBox)
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      body: { tzOffset: new Date().getTimezoneOffset() },
    }),
  });
  
  // Form state (from LogMealForm)
  const [localInput, setLocalInput] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [shareState, setShareState] = useState<'just-me' | 'all' | 'partial'>('just-me');
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    
    // Determine if this is a meal log (has meal type) or chat message
    if (selectedMealType) {
      // Log meal
      startTransition(async () => {
        await logMeal(localInput, selectedMealType, /* share options */);
        setLocalInput('');
        setSelectedMealType('lunch');
        setShareState('just-me');
        router.refresh();
      });
    } else {
      // Send chat message
      sendMessage({ text: localInput });
      setLocalInput('');
    }
  };
  
  return (
    <MealLoggerContainer>
      <HeaderRow>
        <MessageSquare size={24} color="#a855f7" />
        <CardTitle>Plenish Agent</CardTitle>
      </HeaderRow>
      
      <MessageList>
        {/* Chat history from messages */}
      </MessageList>
      
      {/* NEW: Meal type chips */}
      <ChipRow>
        {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((type) => (
          <MealTypeChip
            key={type}
            $active={selectedMealType === type}
            onClick={() => setSelectedMealType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </MealTypeChip>
        ))}
      </ChipRow>
      
      <InputForm onSubmit={handleFormSubmit}>
        <ChatInput
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          placeholder="Type a message or describe your meal..."
          disabled={isPending}
        />
        
        {/* NEW: Share button */}
        {householdMembers.length > 0 && (
          <ShareButton
            type="button"
            $state={shareState}
            onClick={() => {
              // Cycle: just-me → all → partial → just-me
              // Phase 3 adds member picker
            }}
          >
            👤 Just me
          </ShareButton>
        )}
        
        <SendButton type="submit" disabled={isPending || !localInput.trim()}>
          <Send size={18} />
        </SendButton>
      </InputForm>
    </MealLoggerContainer>
  );
}
```

### Phase 2: Integration

**LogMealFormWrapper.tsx** (modify):
- Keep fetching household members
- Pass to `MealLogger` instead of `LogMealForm`

**DashboardLayout.tsx** (modify):
- Rename slot: `logMealFormSlot` → `mealLoggerSlot`
- Component structure unchanged

**page.tsx** (modify):
- Pass `MealLogger` to the renamed slot

### Phase 3: Cleanup

**Deprecate** (keep in codebase for now, don't delete):
- `LogMealForm.tsx` → marked `@deprecated`
- `AIChatBox.tsx` → logic moved to `MealLogger`, but can keep for reference

---

## Styling Strategy

**Reuse from existing components**:
- `ChatContainer`, `MessageBubble`, `InputForm`, `ChatInput`, `SendButton` from `AIChatBox.tsx`
- `Card`, `CardTitle`, `Label`, `SubmitButton` patterns from `LogMealForm.tsx`
- `MemberCheckRow` for chip-like styling inspiration
- Color scheme: meal types (breakfast yellow, lunch green, etc.) already defined

**New styled components**:
- `ChipRow` — flex container for meal type chips
- `MealTypeChip` — toggleable chip button (active = blue border + fill, inactive = gray)
- `ShareButton` — 3-state button (visual only, logic in Phase 3)

---

## Testing Strategy

### Unit Testing (Manual Browser)

1. **Component Renders**:
   - [ ] `MealLogger` displays without errors
   - [ ] Chat area visible with initial message
   - [ ] Meal type chips visible and clickable
   - [ ] Share button present (if household members exist)
   - [ ] Input field and send button visible

2. **Meal Type Chips**:
   - [ ] Clicking a chip highlights it (blue background)
   - [ ] Clicking another chip deselects the previous one
   - [ ] Default chip is `Lunch`
   - [ ] All 4 meal types appear and are selectable

3. **Share Button**:
   - [ ] Shows when household members exist
   - [ ] Hidden when no household members
   - [ ] Displays "👤 Just me" by default
   - [ ] Clicking cycles state (in Phase 3, adds member picker)

4. **Chat Functionality** (from AIChatBox):
   - [ ] Type a chat message, send it
   - [ ] AI response appears in message history
   - [ ] Message list scrolls smoothly
   - [ ] Chat input clears after send

5. **Meal Logging Functionality** (from LogMealForm):
   - [ ] Select meal type chip, type meal description, send
   - [ ] Meal appears in dashboard activity feed
   - [ ] Meal logs with correct meal type
   - [ ] Meal shares correctly (share button state affects persistence)

6. **Mobile Responsiveness**:
   - [ ] Component fits in narrow viewport (390px)
   - [ ] Chips stack or reduce size if needed
   - [ ] Input area remains usable
   - [ ] No horizontal scroll

### Regression Testing

- [ ] Existing meal log CRUD works (delete, edit via AI, etc.)
- [ ] Household member fetch works
- [ ] Share functionality works (household meals appear for other members)
- [ ] AI chat works (responses, streaming, etc.)
- [ ] Recent activity feed updates after meal logging
- [ ] Dashboard layout doesn't break (60/40 split on desktop, stacked on mobile)

### Full End-to-End Test

```
1. User on dashboard sees merged chat/logger interface ✓
2. Clicks breakfast chip ✓
3. Types "2 eggs, toast, coffee" ✓
4. Hits send ✓
5. Message appears in chat as meal confirm ("✓ Logged your breakfast") ✓
6. Meal appears in activity feed with breakfast badge ✓
7. Types chat message "What should I have for lunch?" ✓
8. AI responds with suggestion ✓
9. User selects lunch chip, types suggested meal ✓
10. Meal logs successfully ✓
11. Mobile: All interactions work in narrow viewport ✓
```

---

## Files to Create

- `/src/components/specific/MealLogger.tsx` — Main consolidated component

## Files to Modify

- `/src/components/specific/LogMealFormWrapper.tsx` — Use `MealLogger` instead of `LogMealForm`
- `/src/app/dashboard/DashboardLayout.tsx` — Rename `logMealFormSlot` parameter
- `/src/app/dashboard/page.tsx` — Rename slot usage

## Files to Deprecate

- `/src/components/specific/LogMealForm.tsx` — Mark `@deprecated`
- `/src/components/specific/AIChatBox.tsx` — Mark `@deprecated` (logic moved to MealLogger)

---

## Patterns & Conventions

**Reused Patterns**:
- ✓ Styled-components for all UI
- ✓ `useChat()` from Vercel AI SDK
- ✓ `useTransition` + `router.refresh()` for mutations
- ✓ Card/Container wrapper + CardTitle pattern
- ✓ Lucide React icons with color attributes
- ✓ Props drilling from server fetcher to client component

**New Patterns**:
- Meal type chips as toggleable context hints (not form validation)
- 3-state share button visual states (logic deferred to Phase 3)

---

## Rollout Strategy

1. **Create** `MealLogger.tsx` with full implementation
2. **Modify** `LogMealFormWrapper` to use `MealLogger`
3. **Modify** dashboard routing to pass renamed slot
4. **Test** in browser: chat, meal logging, household sharing, mobile
5. **Commit** with message: "feat(ui): merge chat + log form into unified MealLogger"
6. **Defer** to Phase 3: Member picker popover, advanced share states

---

## Known Limitations & Deferred Work

- **Member Picker**: Deferred to Phase 3 (3-state share button will have full functionality)
- **Meal Edit**: Existing AI-based edit still flows through chat (no UI edit form)
- **Advanced Sharing**: Partial co-eater selection logic deferred to Phase 3
- **Mobile Bottom Sheet**: Deferred to Phase 7 (Phase 1 uses inline chat + FAB stub)
- **Configurable share default**: Current default is `'all'` (share with household). This should be a user-level setting (e.g., stored in a `user_preferences` table or Supabase profile). Deferred to Phase 5 (Settings), where users can choose their preferred default share state.

---

## Success Criteria (Phase 1)

- ✓ Chat and meal logging coexist in one component
- ✓ Meal type chips are visible and functional
- ✓ Share button reflects intended share state (placeholder for full logic)
- ✓ Zero regressions in existing features
- ✓ Mobile and desktop layouts work without breaks
- ✓ Component fits within 600px height with minimal scrolling
