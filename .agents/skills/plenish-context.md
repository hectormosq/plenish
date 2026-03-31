---
name: plenish-context
description: Core context and rules for working on the Plenish Next.js application.
---

# Plenish Context

## Goal
Plenish is an application designed to record eaten meals and provide meal recommendations (weekly plan, updateable on demand). It natively supports English and Spanish but is built primary focusing on a Spanish speaking audience.

## Project Guidelines
- **Framework:** Next.js (App Router, strict TypeScript).
- **Styling:** Styled-components (NO Tailwind CSS), custom classes, ensuring high-quality dark-mode compatible modern UI. SSR wrapper via `src/lib/registry.tsx`.
- **Database:** Supabase for authentication and postgres database, using `pgvector` for meal recommendations and search.
- **Agent Engine:** Vercel AI SDK (with Gemini/Claude providers). Use `ai` package abstractions for generating UI and tool calls.
- **Language Requirements:** Keep code/variables in English, but application content strings, database defaults, and recipe generation should fully support Spanish logic and i18n considerations if explicitly asked.

## Spec-Driven Rules
1. Before proposing large changes, cross-reference `docs/product_spec.md` and `docs/database_schema.md`.
2. Do not introduce Tailwind CSS configurations into the project. Stick exclusively to `styled-components`.
3. Always verify changes using `npm run dev` before finalizing steps.
