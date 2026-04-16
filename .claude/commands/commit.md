# Commit

Stage and commit changes following the project conventions.

## Steps

1. Run `git status` and `git diff --stat HEAD` to understand what changed.
2. Run `npm run build` — fix any type errors before proceeding.
3. Identify the change type: `feat` / `fix` / `refactor` / `chore` / `docs`
4. Identify the scope: always use the issue number (e.g. `012`, `013`). If no issue exists, use the issue number of the closest related feature.
5. Stage only relevant source files — never `.env*`, `node_modules/`, or build artifacts.
6. Commit with the format: `<type>(<issueNumber>): <area> <short summary in English>` — e.g. `feat(012): ui expand calendar to fill viewport` or `fix(013): ai structured recommendation schema`

## Rules
- One logical change per commit.
- Summary line under 72 characters.
- If multiple unrelated changes exist, ask the user which to stage first.
