# Tasks: Phase 1 Implementation Checklist

**Phase**: 004-ui-chat-form-merge | **Date**: 2026-04-10

## Overview

Granular tasks for implementing the MealLogger component. Each task represents a small, testable unit of work that can be verified independently.

---

## Pre-Implementation

### Research & Design Review
- [ ] Read `spec.md` and understand requirements
- [ ] Read `plan.md` and understand technical approach
- [ ] Read `research.md` and identify reusable code
- [ ] Review current `AIChatBox.tsx` and `LogMealForm.tsx` side-by-side
- [ ] Confirm meal type colors and styling conventions

---

## Task Group 1: Component Creation (MealLogger.tsx)

### 1.1 — Create File & Imports
- [ ] Create `/src/components/specific/MealLogger.tsx`
- [ ] Add `'use client'` directive
- [ ] Import styled-components: `import styled from 'styled-components'`
- [ ] Import React hooks: `useChat`, `useTransition`, `useState`, `useRef`, `useEffect`
- [ ] Import Next.js: `useRouter`
- [ ] Import actions: `logMeal`, `MealType`
- [ ] Import types: `HouseholdMemberSimple`, `UIMessage`
- [ ] Import icons: `MessageSquare`, `Send`, `Users` from lucide-react
- [ ] Import UI components: `Card`, `CardTitle` from `@/components/ui/Card`
- [ ] Import transport: `DefaultChatTransport` from `ai`

### 1.2 — Define Styled Components
- [ ] Copy `ChatContainer` from AIChatBox (adjust height if needed)
- [ ] Copy `HeaderRow` from AIChatBox
- [ ] Copy `MessageList` from AIChatBox
- [ ] Copy `MessageBubble` from AIChatBox
- [ ] Copy `InputForm` from AIChatBox
- [ ] Copy `ChatInput` from AIChatBox
- [ ] Copy `SendButton` from AIChatBox
- [ ] **Create new** `ChipRow` — flex container for meal type chips
- [ ] **Create new** `MealTypeChip` — toggleable chip button with `$active` prop
- [ ] **Create new** `ShareButton` — 3-state button (placeholder for Phase 3)

### 1.3 — Define Component Types
- [ ] Define `interface MealLoggerProps { householdMembers?: HouseholdMemberSimple[] }`
- [ ] Type meal type chips as `const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const`

### 1.4 — Implement Component Function
- [ ] Implement `export function MealLogger({ householdMembers = [] }: MealLoggerProps)`
- [ ] Initialize `useRouter()` hook
- [ ] Initialize `useTransition()` hook
- [ ] Initialize `useChat()` hook with `tzOffset` in body
- [ ] Initialize `useState` for:
  - [ ] `localInput` (string)
  - [ ] `selectedMealType` (MealType, default: 'lunch')
  - [ ] `shareState` (string, default: 'just-me')
  - [ ] `selectedCoEaters` (Set<string>, default: empty)
  - [ ] `errorMsg` (string, default: '')
- [ ] Initialize `useRef` for `endOfMessagesRef`
- [ ] Implement `useEffect` for auto-scroll to bottom

### 1.5 — Implement Form Submit Handler
- [ ] Implement `handleFormSubmit(e: React.FormEvent)`
  - [ ] Prevent default
  - [ ] Check `localInput.trim()` not empty
  - [ ] Clear error
  - [ ] Call `startTransition` with async block:
    - [ ] Call `logMeal(localInput, selectedMealType, shareOptions)`
    - [ ] Clear `localInput`
    - [ ] Reset `selectedMealType` to 'lunch'
    - [ ] Reset `shareState` to 'just-me'
    - [ ] Call `router.refresh()`
  - [ ] Catch errors and set `errorMsg`

### 1.6 — Implement Chip Click Handler
- [ ] Implement `handleChipClick(type: MealType)` or use inline callback
- [ ] Update `selectedMealType` state

### 1.7 — Implement Share Button Handler (Placeholder)
- [ ] Implement `handleShareClick()` or use inline callback
- [ ] For Phase 1: Cycle through states (just-me → all → just-me)
- [ ] Defer member picker to Phase 3
- [ ] Console log state for debugging

### 1.8 — Implement Render Method
- [ ] Render `<ChatContainer>`
  - [ ] Render `<HeaderRow>` with icon + title
  - [ ] Render `<MessageList>`
    - [ ] Render initial AI message ("¡Hola! Soy tu asistente...")
    - [ ] Map `messages` and render `<MessageBubble>` for each
    - [ ] Show loading message if `status === 'streaming'`
    - [ ] Show error div if `error` exists
    - [ ] Render `<div ref={endOfMessagesRef} />`
  - [ ] Render `<ChipRow>`
    - [ ] Map `MEAL_TYPES` and render `<MealTypeChip>` for each
    - [ ] Pass `$active={selectedMealType === type}` to chip
    - [ ] Pass `onClick={() => setSelectedMealType(type)}`
  - [ ] Render `<InputForm onSubmit={handleFormSubmit}>`
    - [ ] Render `<ChatInput>` with `value`, `onChange`, `placeholder`, `disabled`
    - [ ] Conditional: If `householdMembers.length > 0` render `<ShareButton>`
    - [ ] Render `<SendButton>` with icon and loading spinner

---

## Task Group 2: Wrapper & Layout Integration

### 2.1 — Update LogMealFormWrapper
- [ ] Read `/src/components/specific/LogMealFormWrapper.tsx`
- [ ] Import `MealLogger` instead of `LogMealForm`
- [ ] Replace `<LogMealForm {...props} />` with `<MealLogger {...props} />`
- [ ] Keep household fetching logic unchanged
- [ ] Keep Suspense fallback unchanged

### 2.2 — Update DashboardLayout
- [ ] Read `/src/app/dashboard/DashboardLayout.tsx`
- [ ] Rename parameter: `logMealFormSlot` → `mealLoggerSlot`
- [ ] Update JSDoc/comments
- [ ] Keep component structure unchanged (just rename)

### 2.3 — Update Dashboard Page
- [ ] Read `/src/app/dashboard/page.tsx`
- [ ] Rename slot reference: `logMealFormSlot` → `mealLoggerSlot`
- [ ] Keep LogMealFormWrapper import and usage unchanged
- [ ] Keep Suspense + fallback unchanged

---

## Task Group 3: Styling & Visual Polish

### 3.1 — Chip Styling
- [ ] Ensure `MealTypeChip` is visually distinct (not like buttons)
- [ ] Active state: blue background + white text
- [ ] Inactive state: transparent background + gray text
- [ ] Hover state: blue border (same as active)
- [ ] Padding: ~0.5rem 1rem (comfortable touch target)
- [ ] Border radius: 20px (pill shape)
- [ ] Transition: smooth 0.2s

### 3.2 — Share Button Styling
- [ ] Ensure `ShareButton` is visually distinct from send button
- [ ] Just me state: transparent, gray border
- [ ] Shared states: blue background/border
- [ ] Padding: ~0.5rem 0.875rem (smaller than send button)
- [ ] Border radius: 8px
- [ ] Add icon if needed (👤, 👥)

### 3.3 — Overall Layout
- [ ] Verify `ChipRow` is between message list and input form
- [ ] Verify `ShareButton` is positioned next to send button (not below)
- [ ] Verify no horizontal overflow
- [ ] Verify colors match existing palette (meal types, blue for share, etc.)

---

## Task Group 4: Testing (Manual)

### 4.1 — Component Renders
- [ ] Start dev server: `npm run dev`
- [ ] Navigate to dashboard
- [ ] Verify `MealLogger` displays without errors
- [ ] Verify chat area visible
- [ ] Verify meal type chips visible
- [ ] Verify share button hidden (no household) or visible (with household)
- [ ] Verify no TypeScript build errors: `npm run build`

### 4.2 — Meal Type Chips
- [ ] Click each chip (Breakfast, Lunch, Snack, Dinner)
- [ ] Verify clicked chip is highlighted (blue)
- [ ] Verify only one chip is active at a time (toggle behavior)
- [ ] Verify default is Lunch

### 4.3 — Share Button (Visual)
- [ ] Verify default shows "👤 Just me"
- [ ] Click share button
- [ ] Verify state cycles (inspect console log or state display)
- [ ] Verify button text/icon updates

### 4.4 — Chat Functionality
- [ ] Type a chat message (e.g., "What's the weather?")
- [ ] Send it
- [ ] Verify message appears in chat history (user bubble)
- [ ] Verify AI response appears (assistant bubble)
- [ ] Verify messages scroll smoothly
- [ ] Verify new messages scroll to bottom automatically

### 4.5 — Meal Logging
- [ ] Click Lunch chip (or verify it's already selected)
- [ ] Type meal description (e.g., "2 chicken tacos with rice")
- [ ] Click send button
- [ ] Verify meal appears in dashboard activity feed
- [ ] Verify meal has "Lunch" label + time
- [ ] Verify `localInput` field clears
- [ ] Verify chat shows confirmation message

### 4.6 — Meal Logging with Different Types
- [ ] Repeat meal logging for Breakfast, Snack, Dinner
- [ ] Verify each logs with correct meal type
- [ ] Verify colors match expected palette (breakfast yellow, lunch green, etc.)

### 4.7 — Share Functionality
- [ ] If household members exist:
  - [ ] Log a meal with "👤 Just me" state
  - [ ] Verify meal only appears for current user (not shared)
  - [ ] Log another meal with "👥 Shared with household" state
  - [ ] Ask another household member to verify they see the shared meal
  - [ ] Verify non-shared meal doesn't appear for them

### 4.8 — Error Handling
- [ ] Try sending empty message (no text)
- [ ] Verify nothing happens (button disabled, no error)
- [ ] Try sending chat message while AI is responding
- [ ] Verify disabled state prevents double-submit

### 4.9 — Mobile Responsiveness
- [ ] Open DevTools (F12)
- [ ] Switch to mobile viewport (390×844)
- [ ] Verify chips stack or compress without overflow
- [ ] Verify input field is usable (not hidden)
- [ ] Verify send button is accessible
- [ ] Verify share button (if visible) doesn't overflow

### 4.10 — Regression Testing
- [ ] Verify existing meal logs still display in activity feed
- [ ] Verify household members fetch correctly
- [ ] Verify AI chat doesn't lose message history
- [ ] Verify delete meal action still works
- [ ] Verify dashboard 60/40 layout doesn't break

---

## Task Group 5: Code Quality

### 5.1 — TypeScript
- [ ] Run `npm run build`
- [ ] Verify zero TypeScript errors
- [ ] Verify strict mode compliance
- [ ] Add JSDoc for component if helpful

### 5.2 — Code Style
- [ ] Verify styled-components formatting (no Tailwind)
- [ ] Verify consistent spacing (2-space indents)
- [ ] Verify consistent naming (camelCase, $props for styled-props)
- [ ] Verify no console logs left (except for debugging)

### 5.3 — Performance
- [ ] Verify component re-renders don't cause heavy updates
- [ ] Verify message list scrolls smoothly even with 50+ messages
- [ ] Verify no memory leaks (useRef cleanup if needed)

---

## Task Group 6: Deprecation & Cleanup

### 6.1 — Mark Old Components as Deprecated
- [ ] In `/src/components/specific/LogMealForm.tsx`, add comment:
  ```typescript
  /**
   * @deprecated Use MealLogger instead (Phase 1: 004-ui-chat-form-merge)
   */
  ```
- [ ] In `/src/components/specific/AIChatBox.tsx`, add comment:
  ```typescript
  /**
   * @deprecated Logic moved to MealLogger (Phase 1: 004-ui-chat-form-merge)
   * Keep for reference; can be deleted in Phase 2+
   */
  ```

### 6.2 — Do NOT Delete Yet
- [ ] Do NOT delete `LogMealForm.tsx` (keep for reference)
- [ ] Do NOT delete `AIChatBox.tsx` (keep for reference)
- [ ] Reason: Phase 2+ may need these patterns; safe to keep for now

---

## Task Group 7: Commit & Documentation

### 7.1 — Git Commit
- [ ] Stage files:
  - [ ] `src/components/specific/MealLogger.tsx` (new)
  - [ ] `src/components/specific/LogMealFormWrapper.tsx` (modified)
  - [ ] `src/app/dashboard/DashboardLayout.tsx` (modified)
  - [ ] `src/app/dashboard/page.tsx` (modified)
- [ ] Write commit message:
  ```
  feat(ui): merge chat + log form into unified MealLogger
  
  - Consolidate AIChatBox + LogMealForm into single component
  - Add meal type chips as alternative to dropdown
  - Implement 3-state share button (visual, logic in Phase 3)
  - Rename logMealFormSlot → mealLoggerSlot in dashboard layout
  - Mark old components as @deprecated
  
  Implements Phase 1 of dashboard UX redesign.
  Closes spec/004-ui-chat-form-merge
  ```
- [ ] Commit: `git commit -m "..."`

### 7.2 — Update Spec File
- [ ] In `spec.md`, update status: `Status: Ready for Planning` → `Status: Implemented`
- [ ] Add completion date

---

## Task Group 8: Next Steps

### 8.1 — Prepare for Phase 2
- [ ] Review Phase 2 spec: `specs/005-ui-weekly-calendar/`
- [ ] Identify any blocking dependencies
- [ ] Plan weekly calendar component structure

### 8.2 — Gather Feedback
- [ ] Share screenshots of MealLogger with team/user
- [ ] Collect feedback on UX (chip sizing, button placement, etc.)
- [ ] Document feedback in `research.md` for Phase 2

---

## Summary

| Task Group | Count | Approx. Time |
|-----------|-------|-------------|
| Component Creation | 8 tasks | 2-3 hours |
| Wrapper & Layout | 3 tasks | 15 min |
| Styling & Polish | 3 tasks | 30 min |
| Testing | 10 tasks | 1 hour |
| Code Quality | 3 tasks | 15 min |
| Deprecation | 2 tasks | 5 min |
| Commit & Docs | 2 tasks | 10 min |
| **Total** | **31 tasks** | **~4.5 hours** |

---

## Verification Checklist (Before Moving to Phase 2)

- [ ] All 31 tasks completed
- [ ] `npm run build` succeeds with zero errors
- [ ] Manual testing passes (all 10 test scenarios)
- [ ] No TypeScript errors
- [ ] No regressions in existing features
- [ ] Mobile layout works (390px viewport)
- [ ] Commit made with message
- [ ] Screenshots/demo ready
- [ ] Spec marked as complete

**Once all verified ✅, proceed to Phase 2: Weekly Calendar**
