---
paths:
  - "src/lib/ai/**"
  - "src/app/api/chat/**"
  - "src/actions/plans.ts"
  - "packages/ai-session-logger/**"
---

# AI Rules

## Layout
- `src/lib/ai/provider.ts` — model factory (`getAIModel`, `getModelName`) and the two system prompts (`getBaseSystemPrompt`, `getFullSystemPrompt`).
- `src/lib/ai/intent-classifier.ts` — UI prefix parsing and keyword intent classification; decides the prompt tier.
- `src/lib/ai/tools/` — tool definitions (`meal-tools.ts`, `plan-tools.ts`). Tools are created per request by a factory.
- `src/lib/ai/getRecommendation.ts` — structured meal plan generation (`generateText` + `Output.object`).
- `src/app/api/chat/route.ts` — the streaming chat endpoint; picks the tier and the tool set.
- `packages/ai-session-logger` — session telemetry. File logging is skipped on Vercel.

## Rules
1. Every tool `execute` re-derives the user with `supabase.auth.getUser()`. Never trust an id that came from the model or the client.
2. A rule that must always hold is enforced in code (schema, tool choice, server-side check), not only stated in a prompt.
3. Keep each tool instruction in one place. Do not repeat or contradict a tool description in the system prompt.
4. Zod schemas given to the model must accept what the model realistically produces; clean the values in `execute` instead of rejecting them, because a rejection triggers a retry.
5. Dates: the browser sends `tzOffset` (minutes, `Date.getTimezoneOffset()`); compute local days from it, never from server time.
6. The provider is chosen by `PLENISH_AI_PROVIDER` (`google` default, `openai`). Do not hardcode a model id outside `provider.ts`.
7. When changing a prompt or tool, check the result against real sessions in `logs/` (git-ignored).
