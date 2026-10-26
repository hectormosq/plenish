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
- `src/lib/ai/router.ts` — intent router: one structured-output call (`log`, `manage`, `plan`, `chat`, `mixed`, plus the internal `revise` only while a v2 meal table is pending); falls back to the keyword classifier on error.
- `src/lib/ai/agents.ts` — system prompts for the manage, plan and chat agents.
- `src/lib/ai/provider.ts` — model factory, the logging prompt (`getBaseSystemPrompt`), the general prompt used for `mixed` and by the planner actions (`getFullSystemPrompt`), and shared prompt pieces.
- `src/lib/ai/log-context.ts` — fields the logging form sends with a message (meal type, date, sharing) and how they merge with what the model infers.
- `src/lib/ai/intent-classifier.ts` — keyword classifier, kept as the router fallback.
- `src/lib/ai/tools/` — tool definitions. Tools are created per request by a factory; each agent gets only the tools it needs.
- `src/lib/ai/getRecommendation.ts` — structured meal plan generation (`generateText` + `Output.object`).
- `packages/ai-session-logger` — session telemetry. File logging is skipped on Vercel.
- `src/lib/ai/log-v2/` — meal logging v2 (feature 045): a code-driven chain of swappable nodes `parse → history → ingredients → portions → gate → nutrition` (`pipeline.ts`), the `revise` node for replies to a meal table (`revise-turn.ts`), draft confirm/update logic (`drafts.ts`), the `MealDraft` schema (`schemas.ts`) and `getEffectivePipeline` (`preferences.ts`). Thresholds in `config.ts`.
- `src/lib/ai/save-meal.ts` — the single write path for a meal (v1 and v2), household and co-eater resolution.
- `src/lib/ai/runs.ts` — `ai_pipeline_runs` telemetry (one row per meal-logging turn; never throws).
- `src/lib/ai/tools/log-v2-tool.ts` — `log_meal_v2`, the v2 pipeline as a tool for the `mixed` agent.
- `evals/` — `npm run eval` (routing, agents, logging, log-v2). Run it after changing a prompt, a tool or the router. Unit tests: `npm run test` (`src/**/*.test.ts`).

## Rules
1. Every tool `execute` re-derives the user with `supabase.auth.getUser()`. Never trust an id that came from the model or the client.
2. A rule that must always hold is enforced in code (schema, tool choice, server-side check), not only stated in a prompt.
3. Keep each tool instruction in one place. Do not repeat or contradict a tool description in the system prompt.
4. Zod schemas given to the model must accept what the model realistically produces; clean the values in `execute` instead of rejecting them, because a rejection triggers a retry.
5. Dates: the browser sends `tzOffset` (minutes, `Date.getTimezoneOffset()`); compute local days from it, never from server time.
6. The provider is chosen by `PLENISH_AI_PROVIDER` (`google` default, `openai`). Do not hardcode a model id outside `provider.ts`; model prices (`MODEL_PRICES`) live there too.
7. When changing a prompt, tool or the router, run `npm run eval` and compare with the previous results in `evals/results/` (git-ignored).
8. Give an agent only the tools its intent needs. Edits and deletions need the user's explicit confirmation first.
9. Structured-output schemas sent to the model must have every field required (OpenAI strict JSON schema is on by default): use nullable fields, never optional or defaulted ones.
10. Users pick the chat logging pipeline (`user_preferences.log_pipeline`). Every meal log from the chat input goes through v1 or v2 according to `getEffectivePipeline`, including form logs (a meal type picked in the input, e.g. from a calendar cell). The values the input already knows (`LogContext`: meal type, day, sharing, co-eaters) always win over what the model infers, in both pipelines.
