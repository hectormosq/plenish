# Eval baseline (v1, before any 045 code change)

Run: `npm run eval` on branch `045-ai-log-v2` at commit `cca1d26`, 2026-10-19, provider `openai` (`gpt-4o-mini`).

| Eval | Result file (`evals/results/`, git-ignored) | Headline |
|------|---------------------------------------------|----------|
| Routing — keyword | `routing-keyword-2026-10-19T16-17-45-832Z.json` | all 43% · log 80% · manage 30% · plan 36% · chat 0% · mixed 0% |
| Routing — model | `routing-model-2026-10-19T16-17-51-191Z.json` | 100% on every intent |
| Logging (45 form logs) | `logging-2026-10-19T16-18-18-673Z.json` | 45/45 on every check except single tool attempt 44/45; 67,086 input / 4,599 output tokens |
| Agents (32 cases) | `agents-2026-10-19T16-18-21-483Z.json` | routed 31/32 · no edit/delete without confirmation 31/32 · log 10/10 · step limit 32/32 · manage 8/8 · plan 8/10 · chat 3/3 · mixed 1/1 |

Known failures in the baseline (not caused by 045): r14 (manage deletes without confirmation), r22 and r23 (plan agent calls no tools), r25 (routed to mixed instead of plan). Model outputs vary between runs, so compare rates, not individual cases; a drop of one case on a check is within noise.
