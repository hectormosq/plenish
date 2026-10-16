---
paths:
  - "src/lib/ai/**"
  - "src/app/api/chat/**"
  - "src/actions/plans.ts"
  - "packages/ai-session-logger/**"
---

# AI Rules

## Layout
- `src/app/api/chat/route.ts` — the streaming chat endpoint. Calls `buildChatTurn`, then streams.
- `src/lib/ai/chat-turn.ts` — `buildChatTurn`: picks the agent, its prompt, its tools and its step limit. Shared with the evals.
- `src/lib/ai/router.ts` — intent router: one structured-output call (`log`, `manage`, `plan`, `chat`, `mixed`); falls back to the keyword classifier on error.
- `src/lib/ai/agents.ts` — system prompts for the manage, plan and chat agents.
- `src/lib/ai/provider.ts` — model factory, the logging prompt (`getBaseSystemPrompt`), the general prompt used for `mixed` and by the planner actions (`getFullSystemPrompt`), and shared prompt pieces.
- `src/lib/ai/log-context.ts` — fields the logging form sends with a message (meal type, date, sharing) and how they merge with what the model infers.
- `src/lib/ai/intent-classifier.ts` — keyword classifier, kept as the router fallback.
- `src/lib/ai/tools/` — tool definitions. Tools are created per request by a factory; each agent gets only the tools it needs.
- `src/lib/ai/getRecommendation.ts` — structured meal plan generation (`generateText` + `Output.object`).
- `packages/ai-session-logger` — session telemetry. File logging is skipped on Vercel.
- `evals/` — `npm run eval` (routing, agents, logging). Run it after changing a prompt, a tool or the router.

## Rules
1. Every tool `execute` re-derives the user with `supabase.auth.getUser()`. Never trust an id that came from the model or the client.
2. A rule that must always hold is enforced in code (schema, tool choice, server-side check), not only stated in a prompt.
3. Keep each tool instruction in one place. Do not repeat or contradict a tool description in the system prompt.
4. Zod schemas given to the model must accept what the model realistically produces; clean the values in `execute` instead of rejecting them, because a rejection triggers a retry.
5. Dates: the browser sends `tzOffset` (minutes, `Date.getTimezoneOffset()`); compute local days from it, never from server time.
6. The provider is chosen by `PLENISH_AI_PROVIDER` (`google` default, `openai`). Do not hardcode a model id outside `provider.ts`.
7. When changing a prompt, tool or the router, run `npm run eval` and compare with the previous results in `evals/results/` (git-ignored).
8. Give an agent only the tools its intent needs. Edits and deletions need the user's explicit confirmation first.
