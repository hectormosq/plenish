import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isTextUIPart,
} from 'ai';
import type { UIMessage } from 'ai';
import { estimateCost, getAIModel, getModelName } from '@/lib/ai/provider';
import { buildChatTurn, turnLoopSettings } from '@/lib/ai/chat-turn';
import { isFormLog, parseLogContext } from '@/lib/ai/log-context';
import { routeMessage } from '@/lib/ai/router';
import { getRun, insertRun, updateRun } from '@/lib/ai/runs';
import type { RunStep } from '@/lib/ai/runs';
import { getEffectivePipeline } from '@/lib/ai/log-v2/preferences';
import { runLogPipelineV2, totals } from '@/lib/ai/log-v2/pipeline';
import type { MealDraft, PlenishUIMessage } from '@/lib/ai/log-v2/schemas';
import { latestDraftIn } from '@/lib/ai/log-v2/draft-parts';
import { describeDraft } from '@/lib/ai/log-v2/reply';
import { handleReviseTurn } from '@/lib/ai/log-v2/revise-turn';
import { createClient } from '@/lib/supabase/server';
import { createServerWriter } from 'ai-session-logger/next/server';

export const runtime = 'nodejs';

/** A v2 reply: the template text, then the meal table (when there is one). */
function draftResponse(reply: string, draft: MealDraft | null): Response {
  const stream = createUIMessageStream<PlenishUIMessage>({
    execute: ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: reply });
      writer.write({ type: 'text-end', id });
      // The run id keeps the part id stable, so a later version replaces it.
      if (draft) writer.write({ type: 'data-meal-draft', id: draft.run_id, data: draft });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { messages, tzOffset, sessionId, logContext: rawLogContext } = await req.json();
  const tz = Number.isFinite(tzOffset) ? tzOffset : 0;
  const correlationId = crypto.randomUUID();

  // ── Turn setup: pipeline, route, agent, prompt, tools and step limits ─────
  const rawMessages  = (messages ?? []) as UIMessage[];
  const lastUserIdx  = rawMessages.findLastIndex((m) => m.role === 'user');
  const lastUserMsg  = rawMessages[lastUserIdx];
  const prevAssistant = rawMessages.slice(0, Math.max(lastUserIdx, 0)).findLast((m) => m.role === 'assistant');
  const textOf = (m?: UIMessage) => (m?.parts ?? []).filter(isTextUIPart).map((p) => p.text).join('\n');

  const model = getAIModel();
  const modelName = getModelName();
  const logContext = parseLogContext(rawLogContext);
  const lastUserText = textOf(lastUserMsg);
  const previousAssistantText = textOf(prevAssistant);
  const pipeline = await getEffectivePipeline(supabase, user.id);

  // Form logs skip the router; everything else is routed exactly once.
  const formLog = isFormLog(logContext);
  // A meal table in the previous assistant message makes the internal 'revise' intent available (v2 only).
  const pendingDraft = !formLog && pipeline !== 'v1' ? latestDraftIn(prevAssistant) : null;
  const routerPrevious = pendingDraft ? `${previousAssistantText}\n${describeDraft(pendingDraft)}` : previousAssistantText;
  const route = formLog
    ? null
    : await routeMessage(model, lastUserText, routerPrevious, { draftPending: pendingDraft !== null });
  const nodeContext = { model, supabase, userId: user.id, tzOffsetMinutes: tz, now: new Date() };

  const writer = sessionId
    ? createServerWriter({ sessionId, userId: user.id, app: 'plenish' })
    : null;

  // ── v2: a reply to the meal table (confirm, correct, cancel) ──────────────
  if (route?.intent === 'revise' && pendingDraft) {
    writer?.promptSent({
      model: modelName,
      prompt: 'log-v2 revise',
      context: { agent: 'log-v2:revise', routeSource: route.source, routeReason: route.reason, pipeline, correlationId },
    });
    const result = await handleReviseTurn(pendingDraft, lastUserText, route.usage, nodeContext);
    writer?.aiResponse({ text: result.reply });
    return draftResponse(result.reply, result.draft);
  }
  // 'revise' is only offered with a table; if it slips through, treat the message as a log.
  if (route?.intent === 'revise') route.intent = 'log';

  // ── v2: a meal report goes straight to the logging pipeline (no agent) ────
  // Form logs (a meal type picked in the input) take the same path, without the router.
  if (pipeline !== 'v1' && (formLog || route?.intent === 'log')) {
    writer?.promptSent({
      model: modelName,
      prompt: 'log-v2 pipeline',
      context: { agent: 'log-v2', routeSource: route?.source ?? 'form', routeReason: route?.reason ?? null, pipeline, correlationId },
    });
    const result = await runLogPipelineV2(
      { text: lastUserText, previousAssistantText, correlationId, intent: formLog ? 'form' : 'log', routerUsage: route?.usage, logContext, startedAt },
      nodeContext,
    );
    writer?.aiResponse({ text: result.reply });
    return draftResponse(result.reply, result.draft);
  }

  const turn = await buildChatTurn({
    model,
    lastUserText,
    previousAssistantText,
    logContext,
    tzOffsetMinutes: tz,
    userId:          user.id,
    supabase,
    sessionId,
    route:           route ?? undefined,
    logPipeline:     pipeline,
    correlationId,
    startedAt,
  });

  // ── Session telemetry ─────────────────────────────────────────────────────
  writer?.promptSent({
    model: modelName,
    prompt: turn.system,
    tokensEst: Math.ceil((turn.system.length + JSON.stringify(messages).length) / 4),
    context: {
      messageCount: messages.length,
      agent:        turn.agent,
      routeSource:  turn.route?.source ?? 'form',
      routeReason:  turn.route?.reason ?? null,
      pipeline,
      correlationId,
    },
  });

  // Only meal-logging turns are recorded as pipeline runs (research R7).
  const runIntent = formLog ? 'form' : turn.agent === 'log' || turn.agent === 'mixed' ? turn.agent : null;

  // ── Streaming ─────────────────────────────────────────────────────────────
  const converted = await convertToModelMessages(messages);
  let firstTokenMs: number | null = null;

  const result = streamText({
    model,
    system:   turn.system,
    messages: converted,
    tools:    turn.tools,
    ...turnLoopSettings(turn),
    onChunk: () => {
      firstTokenMs ??= Date.now() - startedAt;
    },
    onStepFinish: ({ text, toolCalls, toolResults, usage }) => {
      for (const tc of toolCalls) {
        writer?.toolCall(tc.toolName, tc.input as Record<string, unknown>);
      }
      for (const tr of toolResults) {
        writer?.toolResult(tr.toolName, tr.output);
      }
      if (text) {
        writer?.aiResponse({
          text,
          inputTokens:  usage.inputTokens,
          outputTokens: usage.outputTokens,
          tokensUsed:   usage.totalTokens,
        });
      }
    },
    onFinish: async ({ finishReason, steps, totalUsage }) => {
      // Stopped by the step limit while still calling tools: the agent did not finish its job.
      if (finishReason === 'tool-calls') {
        console.warn(`Chat turn hit the step limit (agent=${turn.agent}, steps=${steps.length}).`);
      }
      if (!runIntent) return;

      const routerUsage = route?.usage ?? { inputTokens: 0, outputTokens: 0, latencyMs: 0 };
      const agentInput  = totalUsage.inputTokens ?? 0;
      const agentOutput = totalUsage.outputTokens ?? 0;
      const inputTokens  = routerUsage.inputTokens + agentInput;
      const outputTokens = routerUsage.outputTokens + agentOutput;

      const savedMeal = steps
        .flatMap((s) => s.toolResults)
        .map((tr) => tr.output as { success?: boolean; meal_id?: string } | undefined)
        .find((out) => out?.success && out.meal_id);

      const runSteps: RunStep[] = [
        ...(route ? [{ name: 'router', input_tokens: routerUsage.inputTokens, output_tokens: routerUsage.outputTokens, latency_ms: routerUsage.latencyMs, summary: { intent: route.intent, source: route.source } }] : []),
        { name: `agent:${turn.agent}`, input_tokens: agentInput, output_tokens: agentOutput, latency_ms: Date.now() - startedAt - routerUsage.latencyMs, summary: { steps: steps.length, first_token_ms: firstTokenMs } },
      ];

      const logCall = steps
        .flatMap((s) => s.toolResults)
        .find((tr) => tr.toolName === 'log_meal' || tr.toolName === 'log_meal_v2');
      // A mixed turn whose agent never logged is not a meal-logging turn.
      if (runIntent === 'mixed' && !logCall) return;

      // A v2 user's mixed turn: the log tool already wrote the v2 run; add the
      // agent's usage to it. If that row cannot be read, the usage is dropped
      // rather than written as a second, incomplete v2 run.
      if (logCall?.toolName === 'log_meal_v2') {
        const runId = (logCall.output as { runId?: string } | undefined)?.runId;
        const existing = runId ? await getRun(supabase, runId) : null;
        if (!runId || !existing) {
          console.warn('Could not add the mixed agent usage to its v2 run.');
          return;
        }
        const merged = [...runSteps, ...(existing.steps ?? [])];
        const sum = totals(merged);
        await updateRun(supabase, runId, {
          steps: merged,
          input_tokens: sum.input,
          output_tokens: sum.output,
          est_cost_usd: estimateCost(modelName, sum.input, sum.output),
          latency_ms: Date.now() - startedAt,
        });
        return;
      }

      await insertRun(supabase, {
        correlation_id: correlationId,
        // v2 runs are written by the pipeline itself; only v1 turns get here.
        variant:        'v1',
        intent:         runIntent,
        meal_log_id:    savedMeal?.meal_id ?? null,
        model:          modelName,
        input_tokens:   inputTokens,
        output_tokens:  outputTokens,
        est_cost_usd:   estimateCost(modelName, inputTokens, outputTokens),
        latency_ms:     Date.now() - startedAt,
        steps:          runSteps,
        outcome:        savedMeal ? 'saved' : null,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
