# Requirements Verification Checklist

**Phase**: 004-ui-chat-form-merge | **Date**: 2026-04-10

## Functional Requirements

### FR-001: Consolidate Components
- [ ] `MealLogger.tsx` created and combines `AIChatBox` + `LogMealForm`
- [ ] Component imported in `LogMealFormWrapper`
- [ ] Component renders without errors
- [ ] No duplicate UI elements (single chat area, single input field)

### FR-002: Display Meal Type Chips
- [ ] Meal type chips visible (`Breakfast`, `Lunch`, `Snack`, `Dinner`)
- [ ] Chips appear above input field
- [ ] Chips replace dropdown from old `LogMealForm`
- [ ] All 4 meal types present and clickable

### FR-003: Pre-Select Meal Type on Chip Click
- [ ] Clicking a chip highlights it visually
- [ ] Chip selection updates internal state
- [ ] Selected meal type applies to next meal log
- [ ] Only one chip can be active at a time

### FR-004: Retain Chat Functionality
- [ ] Chat history displays messages
- [ ] User messages appear in blue bubbles (user role)
- [ ] Assistant messages appear in gray bubbles (assistant role)
- [ ] New messages scroll into view automatically
- [ ] AI responses are real-time (streaming)

### FR-005: Retain Meal Logging Functionality
- [ ] Meal logging via `logMeal` server action works
- [ ] Logged meals appear in dashboard activity feed
- [ ] Meals persist in database with correct meal type
- [ ] Errors are caught and displayed to user

### FR-006: Display 3-State Share Button
- [ ] Share button visible when household members exist
- [ ] Share button hidden when no household members
- [ ] Default state shows "👤 Just me"
- [ ] Button next to send button (not below)

### FR-007: Handle Share State
- [ ] Share state affects meal persistence
- [ ] "Just me" state doesn't share meal
- [ ] "Shared with household" state shares with all members
- [ ] Partial state doesn't store co-eater IDs yet (Phase 3 feature)

### FR-008: Support Both Chat & Meal Logging
- [ ] Type a chat message, send it → AI responds
- [ ] Select meal type chip, type meal, send → meal logs
- [ ] Behavior distinguishable based on context (meal type selected vs. not)

### FR-009: Show Confirmation After Logging
- [ ] After meal logs, brief confirmation appears in chat
- [ ] Message like "✓ Logged your lunch"
- [ ] Confirmation appears in message history

### FR-010: Update Dashboard Slot Naming
- [ ] `logMealFormSlot` renamed to `mealLoggerSlot` in `DashboardLayout`
- [ ] `DashboardLayout` props updated (JSDoc + signature)
- [ ] Dashboard page passes renamed slot correctly

---

## UI/UX Requirements

### UX-001: Meal Type Chips Styling
- [ ] Chips styled as toggleable buttons (not form select)
- [ ] Active chip: blue background + white text
- [ ] Inactive chip: transparent + gray text
- [ ] Chip styling consistent with `MemberCheckRow` or custom design
- [ ] Hover state visible (blue border at minimum)

### UX-002: 3-State Button Implementation
- [ ] Button shows correct visual for each state:
  - [ ] "👤 Just me" (default, transparent)
  - [ ] "👥 Shared with household" (blue fill)
  - [ ] "👥 Names..." (blue, shows member names/count) — Phase 3
- [ ] Phase 1: Visual states correct, member picker deferred

### UX-003: Component Height & Scrolling
- [ ] Component fits within 600px fixed height (same as old chat)
- [ ] Chat messages scroll smoothly
- [ ] Input area always visible (doesn't scroll out of view)
- [ ] No horizontal overflow

### UX-004: Conversational UX
- [ ] Single unified text field (not multiple form sections)
- [ ] Meal type chips are optional context (not required)
- [ ] User can interact naturally (feels like chat, not a form)

### UX-005: Optional Chips
- [ ] User doesn't have to select a chip to send message
- [ ] User can log meal without chips (via AI: "I had tacos")
- [ ] Chips are hints/context, not validation

---

## Technical Requirements

### TR-001: Styled-Components Only
- [ ] No Tailwind classes used
- [ ] All styling via styled-components `styled.div`, `styled.button`, etc.
- [ ] Consistent with existing codebase style

### TR-002: Client Component
- [ ] `'use client'` directive present
- [ ] Component is React client component (uses hooks)

### TR-003: Reuse Vercel AI SDK
- [ ] `useChat()` hook used (from `@ai-sdk/react`)
- [ ] `DefaultChatTransport` with `tzOffset` passed correctly
- [ ] Chat state managed by hook (messages, status, sendMessage)

### TR-004: Reuse Next.js Patterns
- [ ] `useTransition` for async meal logging
- [ ] `router.refresh()` after meal logged
- [ ] `useRouter` from `'next/navigation'`
- [ ] Error handling with try/catch

### TR-005: Accept Props Correctly
- [ ] Component accepts `householdMembers?: HouseholdMemberSimple[]`
- [ ] Prop passed from `LogMealFormWrapper`
- [ ] Household members used for share button visibility + member list (Phase 3)

### TR-006: No Breaking Changes
- [ ] Existing `logMeal` server action unchanged
- [ ] Existing household fetchers unchanged
- [ ] `RecentMeals` grid still updates after meal log
- [ ] `router.refresh()` invalidates cache correctly

---

## Testing Requirements

### Test-001: Component Renders
- [ ] MealLogger component renders without errors
- [ ] No console errors on mount
- [ ] TypeScript build succeeds

### Test-002: Meal Type Chips Work
- [ ] Each chip is clickable
- [ ] Active chip highlights correctly
- [ ] Only one chip active at a time
- [ ] Default chip is "Lunch"

### Test-003: Chat Works
- [ ] Send chat message → AI responds
- [ ] Messages display in history
- [ ] Scrolls to new message automatically
- [ ] Loading state shown while AI responds

### Test-004: Meal Logging Works
- [ ] Select chip, type meal, send → meal logs
- [ ] Meal appears in activity feed with correct type
- [ ] Database persistence verified (reload page, meal still there)
- [ ] Household sharing works if button clicked

### Test-005: Share Button Works
- [ ] Hidden if no household members
- [ ] Visible if household members exist
- [ ] Default shows "Just me"
- [ ] State cycles on click (Phase 1: visual only)

### Test-006: Mobile Responsive
- [ ] Works on 390×844 viewport
- [ ] Chips stack or compress (no horizontal scroll)
- [ ] Input field usable on mobile
- [ ] No layout breaks

### Test-007: No Regressions
- [ ] Existing meal logs display
- [ ] Delete meal still works
- [ ] Household fetch works
- [ ] Dashboard layout intact (60/40 split on desktop, stacked on mobile)

---

## Acceptance Criteria Summary

### Must-Have ✅
- [x] MealLogger component created and working
- [x] Chat functionality identical to old AIChatBox
- [x] Meal logging identical to old LogMealForm
- [x] Meal type chips visible and functional
- [x] Share button shows 3 states visually
- [x] Desktop and mobile layouts work
- [x] Zero TypeScript errors
- [x] Zero regressions in existing features

### Nice-to-Have ⭐
- [ ] Chips have custom icons (fork/fork-knife for meals)
- [ ] Confirmation message is animated
- [ ] Smooth transitions between states
- [ ] Accessibility (ARIA labels, keyboard navigation)

### Deferred to Phase 3 🔄
- [ ] Member picker popover for partial sharing
- [ ] Advanced share logic (specific co-eaters)

---

## Sign-Off

### Developer Verification
- [ ] Implemented spec.md requirements
- [ ] Passed all manual tests
- [ ] No TypeScript errors
- [ ] Commit message clear
- [ ] Code ready for review

**Developer**: _________________ | **Date**: _________

### Code Review
- [ ] Reviewed implementation
- [ ] Verified no regressions
- [ ] Styling consistent with codebase
- [ ] Architecture follows patterns
- [ ] Ready to merge

**Reviewer**: _________________ | **Date**: _________

### QA/User Testing
- [ ] Manual testing passed
- [ ] Mobile and desktop verified
- [ ] UX feels natural and consistent
- [ ] Ready for Phase 2

**QA**: _________________ | **Date**: _________
